"""Firestore repository functions for Status and Cities collections."""
from __future__ import annotations

from datetime import datetime
from typing import Any, List, Optional
import os

from firebase_admin import firestore  # type: ignore

from backend.firebase import init_firebase

init_firebase()
_client = firestore.client()

STATUS_COLL = _client.collection("status").document("current")
CITIES_COLL = _client.collection("cities")
MERCH_COLL = _client.collection("merch")
SETTINGS_DOC = _client.collection("settings").document("globals")

# Posts subcollection name constant
POSTS_SUB = "posts"


# ------------------ Status ------------------

def get_status() -> Optional[dict[str, Any]]:
    doc = STATUS_COLL.get()
    return doc.to_dict() if doc.exists else None


def update_status(payload: dict[str, Any]) -> dict[str, Any]:
    payload["lastUpdated"] = datetime.utcnow().isoformat()
    STATUS_COLL.set(payload, merge=True)
    return get_status()  # type: ignore


# ------------------ Cities ------------------

def list_cities() -> List[dict[str, Any]]:
    docs = [doc.to_dict() | {"id": int(doc.id)} for doc in CITIES_COLL.stream()]
    # Ensure sort by 'order', default 0 when missing
    docs.sort(key=lambda d: (d.get("order") or 0))
    return docs


def get_city(city_id: int) -> Optional[dict[str, Any]]:
    doc = CITIES_COLL.document(str(city_id)).get()
    if doc.exists:
        return doc.to_dict() | {"id": city_id}
    return None


def update_city(city_id: int, data: dict[str, Any]) -> dict[str, Any]:
    doc_ref = CITIES_COLL.document(str(city_id))
    doc_ref.set(data, merge=True)
    doc = doc_ref.get()
    return doc.to_dict() | {"id": city_id}


# ------------------ Posts ------------------


def save_city_posts(city_id: int, posts: list[dict[str, Any]], *, cap: Optional[int] = 100) -> None:
    """Replace the city's posts subcollection with the provided list.

    cap: maximum posts to save (default 100). Use None to disable cap.
    """
    doc_ref = CITIES_COLL.document(str(city_id))

    # Ensure Firestore Timestamp field and sort newest→oldest
    def _ensure_ts_dt(p: dict[str, Any]) -> None:
        if p.get("timestampDt") is None:
            dt = _parse_iso(p.get("timestamp"))
            if dt is not None:
                p["timestampDt"] = dt

    for p in posts:
        try:
            _ensure_ts_dt(p)
        except Exception:
            pass

    def _ts_key(p: dict[str, Any]):
        v = p.get("timestampDt") or p.get("timestamp") or ""
        try:
            if hasattr(v, "isoformat"):
                return v.isoformat()
            return str(v)
        except Exception:
            return ""

    # Deduplicate posts before persisting to Firestore to avoid duplicates in subcollection
    def _canon_url(u: Any) -> str:
        try:
            s = str(u or "").strip()
            if not s:
                return ""
            # drop query/fragment and normalise trailing slash & case for host
            base = s.split("?")[0].split("#")[0].rstrip("/")
            return base
        except Exception:
            return ""

    seen: set[str] = set()
    deduped: list[dict[str, Any]] = []
    for p in posts:
        try:
            platform = str(p.get("platform") or "").strip().lower()
            post_id = p.get("id") or p.get("postId") or p.get("post_id")
            url_key = _canon_url(
                p.get("url")
                or p.get("link")
                or p.get("permalink")
                or p.get("postUrl")
                or p.get("post_url")
            )
            if platform and post_id:
                key = f"pid:{platform}:{post_id}"
            elif url_key:
                key = f"url:{url_key}"
            else:
                ts_val = p.get("timestampDt") or p.get("timestamp") or ""
                cap = str(p.get("caption") or "").strip()
                cap_key = cap[:64]
                key = f"tscap:{platform}:{ts_val}:{cap_key}"
            if key in seen:
                continue
            seen.add(key)
            deduped.append(p)
        except Exception:
            # If anything goes wrong, keep the post rather than risk data loss
            deduped.append(p)

    posts = deduped

    try:
        posts = sorted(posts, key=_ts_key, reverse=True)
    except Exception:
        pass

    # Delete existing docs (simpler; limit 100) – Firestore limits to 500 per batch.
    existing = list(doc_ref.collection(POSTS_SUB).stream())
    # Firestore batch limit is 500 operations; use chunks for safety
    def _commit_deletes(docs: list) -> None:
        if not docs:
            return
        # chunk deletes
        chunk_size = 450
        for i in range(0, len(docs), chunk_size):
            chunk = docs[i:i+chunk_size]
            b = _client.batch()
            for d in chunk:
                b.delete(d.reference)
            b.commit()

    # Add new posts (respect cap)
    _commit_deletes(existing)
    print(f"[Firestore] City {city_id}: deleted {len(existing)} existing posts")

    to_write = posts if cap is None else posts[:cap]
    if not to_write:
        print(f"[Firestore] City {city_id}: nothing to write (cap={cap})")
        return
    # chunk writes
    chunk_size = 450
    for i in range(0, len(to_write), chunk_size):
        chunk = to_write[i:i+chunk_size]
        b = _client.batch()
        for p in chunk:
            new_ref = doc_ref.collection(POSTS_SUB).document()
            b.set(new_ref, p)
        b.commit()
        print(f"[Firestore] City {city_id}: wrote batch {i//chunk_size+1} size={len(chunk)}")
    # verify count
    count = len(list(doc_ref.collection(POSTS_SUB).stream()))
    print(f"[Firestore] City {city_id}: total saved={count}")


def _parse_iso(ts: Any) -> Optional[datetime]:
    """Parse a timestamp value (str or datetime) into naive UTC datetime."""
    try:
        from datetime import timezone as _tz
        if isinstance(ts, datetime):
            dt = ts
        elif isinstance(ts, str):
            dt = datetime.fromisoformat(ts.replace("Z", "+00:00"))
        else:
            return None
        if dt.tzinfo is not None:
            dt = dt.astimezone(_tz.utc).replace(tzinfo=None)
        return dt
    except Exception:
        return None


def repartition_posts_across_cities(*, cap: Optional[int] = 100) -> dict[str, Any]:
    """Reassign posts into each city's posts subcollection based on city start times.

    Rule: A post with timestamp T belongs to the city whose window
    [city.start, next_city.start) contains T. The last city's window is open-ended.

    Returns a summary dict with counts moved/written per city.
    """
    cities = list_cities()
    # Consider ONLY cities with a valid Start time
    started: list[tuple[int, datetime, dict[str, Any]]] = []
    for c in cities:
        start_iso = c.get("lastCurrentAt") or c.get("last_current_at")
        dt = _parse_iso(start_iso)
        if dt is not None:
            started.append((c["id"], dt, c))

    if not started:
        return {"changed": False, "reason": "no valid start times"}

    # Sort strictly by start time ascending
    started.sort(key=lambda t: t[1])

    # Build windows [start_i, start_{i+1}) and last open-ended
    windows: list[tuple[int, datetime, Optional[datetime]]] = []
    for idx, (cid, sdt, _c) in enumerate(started):
        next_start = started[idx + 1][1] if idx + 1 < len(started) else None
        windows.append((cid, sdt, next_start))

    # Helper: find target city for a timestamp (accepts datetime or iso string)
    def _target_city(ts_val: Any) -> Optional[int]:
        ts_dt = _parse_iso(ts_val)
        if ts_dt is None:
            return None
        for cid, s, e in windows:
            if (ts_dt >= s) and (e is None or ts_dt < e):
                return cid
        return None

    # Gather all posts from all cities
    all_posts: list[tuple[int, dict[str, Any]]] = []
    for c in cities:
        for p in list_city_posts(c["id"]):
            all_posts.append((c["id"], p))

    # Reassign into buckets
    per_city: dict[int, list[dict[str, Any]]] = {c["id"]: [] for c in cities}
    moved = 0
    moved_by_city: dict[int, int] = {}
    for original_city_id, post in all_posts:
        tgt = _target_city(post.get("timestampDt") or post.get("timestamp"))
        if tgt is None:
            # Leave in original bucket if no matching window
            tgt = original_city_id
        if tgt != original_city_id:
            moved += 1
            moved_by_city[tgt] = moved_by_city.get(tgt, 0) + 1
        per_city.setdefault(tgt, []).append(post)

    # Persist per city (sorted in save_city_posts)
    for cid, posts in per_city.items():
        save_city_posts(cid, posts, cap=cap)

    print(f"[Repartition] Moved {moved} posts. Per-city moved: {moved_by_city}")
    return {"changed": True, "moved": moved, "cities": {str(k): len(v) for k, v in per_city.items()}, "movedByCity": {str(k): v for k, v in moved_by_city.items()}}


def list_city_posts(city_id: int) -> list[dict[str, Any]]:
    doc_ref = CITIES_COLL.document(str(city_id))
    return [d.to_dict() | {"id": d.id} for d in doc_ref.collection(POSTS_SUB).stream()]

# ------------------ Settings ------------------


DEFAULT_SETTINGS = {
    "socialScrapeIntervalMin": 5,
    "instagramUsername": "",
    "twitterUsername": "",
    "tiktokUsername": "",
    "twitchUsername": "",
    "youtubeUsername": "",
    "socialHashtag": "SpeedDoesAmerica",
    # Curator.io integration (prefer when configured)
    "curatorApiBase": "",
    "curatorApiKey": "",
    "curatorFeedId": "",
    # Alternatively, provide a direct JSON URL from Curator's published feed
    "curatorJsonUrl": "",
    # Feature flags
    "disableMerch": False,
    "sleepHideUserBar": False,
    # Universal departure time (HH:MM, 24h, UTC) for travel interpolation
    "departureTime": "22:00",
    # Cached minutes since midnight UTC for departureTime (computed client-side)
    "departureTimeUtc": 1320,
}


def get_settings() -> dict[str, Any]:
    doc = SETTINGS_DOC.get()
    data = doc.to_dict() if doc.exists else {}
    # env overrides (do not include secrets in response by default)
    env_overrides: dict[str, Any] = {}
    if os.getenv("CURATOR_JSON_URL"):
        env_overrides["curatorJsonUrl"] = os.getenv("CURATOR_JSON_URL")
    if os.getenv("CURATOR_API_BASE"):
        env_overrides["curatorApiBase"] = os.getenv("CURATOR_API_BASE")
    if os.getenv("CURATOR_FEED_ID"):
        env_overrides["curatorFeedId"] = os.getenv("CURATOR_FEED_ID")
    # Intentionally do NOT expose CURATOR_API_KEY via GET settings
    merged = {**DEFAULT_SETTINGS, **(data or {}), **env_overrides}
    return merged


def update_settings(data: dict[str, Any]) -> dict[str, Any]:
    # Never persist API key via settings to avoid accidental exposure
    if "curatorApiKey" in data:
        data = {k: v for k, v in data.items() if k != "curatorApiKey"}
    SETTINGS_DOC.set(data, merge=True)
    return get_settings()


# ------------------ Merch ------------------


def list_merch() -> list[dict[str, Any]]:
    return [doc.to_dict() | {"id": doc.id} for doc in MERCH_COLL.stream()]


def create_merch(data: dict[str, Any]) -> dict[str, Any]:
    doc_ref = MERCH_COLL.document()
    doc_ref.set(data)
    return data | {"id": doc_ref.id}


def update_merch(item_id: str, data: dict[str, Any]) -> dict[str, Any]:
    doc_ref = MERCH_COLL.document(item_id)
    doc_ref.set(data, merge=True)
    return doc_ref.get().to_dict() | {"id": item_id}

# ------------------ Sleep flag ------------------


def get_sleep_flag() -> bool:
    doc = get_status()
    return bool(doc.get("isSleep")) if doc else False


def get_sleep_state() -> dict[str, Any]:
    """Return current sleep/traveling flags from status doc.

    Shape: { "isSleep": bool, "isTraveling": bool }
    """
    doc = get_status() or {}
    return {
        "isSleep": bool(doc.get("isSleep")) if doc is not None else False,
        "isTraveling": bool(doc.get("isTraveling")) if doc is not None else False,
    }


def set_sleep_flag(is_sleep: bool) -> bool:
    update_status({"isSleep": is_sleep})
    return is_sleep


def set_sleep_state(*, is_sleep: bool | None = None, is_traveling: bool | None = None) -> dict[str, Any]:
    """Update one or both sleep state flags and return the merged state."""
    payload: dict[str, Any] = {}
    if is_sleep is not None:
        payload["isSleep"] = is_sleep
    if is_traveling is not None:
        payload["isTraveling"] = is_traveling
    if payload:
        update_status(payload)
    return get_sleep_state()


# ------------------ Journey helper ------------------


def compute_journey() -> dict[str, Any]:
    all_cities = list_cities()

    def has_coords(c: dict[str, Any]) -> bool:
        lat = c.get("lat") or 0.0
        lng = c.get("lng") or 0.0
        return not (abs(lat) < 0.0001 and abs(lng) < 0.0001)

    cities = [c for c in all_cities if has_coords(c)]

    # Ensure order is an int even if missing
    for c in cities:
        if c.get("order") is None:
            c["order"] = 0

    cities.sort(key=lambda c: c["order"])

    current = next((c for c in cities if c.get("isCurrent")), (cities[0] if cities else None))

    if current and current.get("order") is not None:
        path = [c for c in cities if c["order"] < current["order"]]
    else:
        path = []

    # Determine next city (by order) if any
    next_city = None
    if current and current.get("order") is not None:
        higher = [c for c in cities if (c.get("order") or 0) > (current.get("order") or 0)]
        higher.sort(key=lambda c: c.get("order") or 0)
        next_city = higher[0] if higher else None

    return {
        "currentCity": current,
        "path": path,
        "nextCity": next_city,
    }

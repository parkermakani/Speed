"""Supabase repository functions for Speed data access.

This module replaces firestore_repo.py with Supabase PostgreSQL operations.
All tables use clientId for multi-tenant isolation.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, List, Optional
import os

from backend.supabase_client import get_supabase, get_client_id


# ------------------ Tours ------------------


def list_tours() -> List[dict[str, Any]]:
    """List all tours ordered by displayOrder."""
    client = get_supabase()
    client_id = get_client_id()

    result = (
        client.from_("speed_tours")
        .select("*")
        .eq("clientId", client_id)
        .order("displayOrder")
        .execute()
    )

    return [dict(row) for row in result.data or []]


def get_tour(tour_id: str) -> Optional[dict[str, Any]]:
    """Get a single tour by ID."""
    client = get_supabase()
    client_id = get_client_id()

    try:
        result = (
            client.from_("speed_tours")
            .select("*")
            .eq("clientId", client_id)
            .eq("id", tour_id)
            .execute()
        )
        if result and hasattr(result, 'data') and result.data:
            return result.data[0] if isinstance(result.data, list) else result.data
        return None
    except Exception:
        return None


def get_active_tour() -> Optional[dict[str, Any]]:
    """Get the currently active tour (from status.activeTourId)."""
    status = get_status()
    if not status:
        return None
    tour_id = status.get("activeTourId")
    if tour_id:
        return get_tour(tour_id)
    # Default to first tour
    tours = list_tours()
    return tours[0] if tours else None


def set_active_tour(tour_id: str) -> dict[str, Any]:
    """Set the active tour in status."""
    return update_status({"activeTourId": tour_id})


def update_tour(tour_id: str, data: dict[str, Any]) -> Optional[dict[str, Any]]:
    """Update a tour record."""
    client = get_supabase()
    client_id = get_client_id()

    data["updatedAt"] = datetime.now(timezone.utc).isoformat()

    # Remove fields that shouldn't be updated directly
    safe_data = {k: v for k, v in data.items() if k not in ["id", "clientId", "createdAt"]}

    client.from_("speed_tours").update(safe_data).eq("clientId", client_id).eq(
        "id", tour_id
    ).execute()

    return get_tour(tour_id)


def _get_cities_table_for_tour(tour_id: str) -> str:
    """Get the cities table name for a specific tour."""
    # Map tour IDs to their specific city tables
    table_map = {
        "america": "speed_cities_america",
        "africa": "speed_cities_africa",
    }
    return table_map.get(tour_id, "speed_cities_america")


def _get_posts_table_for_tour(tour_id: str) -> str:
    """Get the posts table name for a specific tour."""
    table_map = {
        "america": "speed_posts",  # Legacy table for America
        "africa": "speed_posts_africa",
    }
    return table_map.get(tour_id, "speed_posts")


def list_cities_for_tour(tour_id: str) -> List[dict[str, Any]]:
    """List all cities for a specific tour."""
    client = get_supabase()
    client_id = get_client_id()
    table = _get_cities_table_for_tour(tour_id)

    result = (
        client.from_(table)
        .select("*")
        .eq("clientId", client_id)
        .order("order")
        .execute()
    )

    docs = []
    for row in result.data or []:
        doc = dict(row)
        try:
            doc["id"] = int(doc["id"])
        except (ValueError, TypeError):
            pass
        docs.append(doc)
    return docs


def get_city_for_tour(tour_id: str, city_id: int) -> Optional[dict[str, Any]]:
    """Get a single city by ID for a specific tour."""
    client = get_supabase()
    client_id = get_client_id()
    table = _get_cities_table_for_tour(tour_id)

    try:
        result = (
            client.from_(table)
            .select("*")
            .eq("clientId", client_id)
            .eq("id", str(city_id))
            .execute()
        )
    except Exception:
        return None

    if result and hasattr(result, 'data') and result.data:
        row = result.data[0] if isinstance(result.data, list) else result.data
        doc = dict(row)
        try:
            doc["id"] = int(doc["id"])
        except (ValueError, TypeError):
            pass
        return doc
    return None


def update_city_for_tour(tour_id: str, city_id: int, data: dict[str, Any]) -> dict[str, Any]:
    """Update a city record for a specific tour."""
    client = get_supabase()
    client_id = get_client_id()
    table = _get_cities_table_for_tour(tour_id)

    data["updatedAt"] = datetime.now(timezone.utc).isoformat()

    client.from_(table).update(data).eq("clientId", client_id).eq(
        "id", str(city_id)
    ).execute()

    return get_city_for_tour(tour_id, city_id)  # type: ignore


def compute_journey_for_tour(tour_id: str) -> dict[str, Any]:
    """Compute journey state for a specific tour."""
    all_cities = list_cities_for_tour(tour_id)

    def has_coords(c: dict[str, Any]) -> bool:
        lat = c.get("lat") or 0.0
        lng = c.get("lng") or 0.0
        return not (abs(lat) < 0.0001 and abs(lng) < 0.0001)

    cities = [c for c in all_cities if has_coords(c)]

    for c in cities:
        if c.get("order") is None:
            c["order"] = 0

    cities.sort(key=lambda c: c["order"])

    current = next(
        (c for c in cities if c.get("isCurrent")), (cities[0] if cities else None)
    )

    if current and current.get("order") is not None:
        path = [c for c in cities if c["order"] < current["order"]]
    else:
        path = []

    next_city = None
    if current and current.get("order") is not None:
        higher = [
            c for c in cities if (c.get("order") or 0) > (current.get("order") or 0)
        ]
        higher.sort(key=lambda c: c.get("order") or 0)
        next_city = higher[0] if higher else None

    return {
        "currentCity": current,
        "path": path,
        "nextCity": next_city,
    }


# ------------------ Status ------------------


def get_status() -> Optional[dict[str, Any]]:
    """Fetch current status from Supabase."""
    client = get_supabase()
    client_id = get_client_id()

    try:
        result = (
            client.from_("speed_status")
            .select("*")
            .eq("clientId", client_id)
            .execute()
        )
        if result and hasattr(result, 'data') and result.data:
            return result.data[0] if isinstance(result.data, list) else result.data
        return None
    except Exception:
        return None


def update_status(payload: dict[str, Any]) -> dict[str, Any]:
    """Update or insert status record."""
    client = get_supabase()
    client_id = get_client_id()

    now = datetime.now(timezone.utc).isoformat()
    payload["clientId"] = client_id
    payload["lastUpdated"] = now
    payload["updatedAt"] = now

    # Upsert based on clientId
    client.from_("speed_status").upsert(payload, on_conflict="clientId").execute()

    return get_status()  # type: ignore


# ------------------ Cities ------------------


def list_cities(tour_id: Optional[str] = None) -> List[dict[str, Any]]:
    """List all cities ordered by 'order' field.

    If tour_id is provided, lists cities for that tour.
    If tour_id is None, defaults to America tour for backwards compatibility.
    """
    if tour_id is None:
        tour_id = "america"
    return list_cities_for_tour(tour_id)


def get_city(city_id: int, tour_id: Optional[str] = None) -> Optional[dict[str, Any]]:
    """Get a single city by ID.

    If tour_id is None, defaults to America tour for backwards compatibility.
    """
    if tour_id is None:
        tour_id = "america"
    return get_city_for_tour(tour_id, city_id)


def update_city(city_id: int, data: dict[str, Any], tour_id: Optional[str] = None) -> dict[str, Any]:
    """Update a city record.

    If tour_id is None, defaults to America tour for backwards compatibility.
    """
    if tour_id is None:
        tour_id = "america"
    return update_city_for_tour(tour_id, city_id, data)


# ------------------ Posts ------------------


def _parse_iso(ts: Any) -> Optional[datetime]:
    """Parse a timestamp value (str or datetime) into UTC datetime."""
    try:
        if isinstance(ts, datetime):
            dt = ts
        elif isinstance(ts, str):
            dt = datetime.fromisoformat(ts.replace("Z", "+00:00"))
        else:
            return None
        if dt.tzinfo is not None:
            dt = dt.astimezone(timezone.utc)
        return dt
    except Exception:
        return None


def _parse_timestamp_iso(ts: Any) -> Optional[str]:
    """Parse timestamp to ISO format string for Supabase."""
    dt = _parse_iso(ts)
    if dt:
        return dt.isoformat()
    return None


def save_city_posts(
    city_id: int, posts: list[dict[str, Any]], *, cap: Optional[int] = 100
) -> None:
    """Replace the city's posts with the provided list.

    cap: maximum posts to save (default 100). Use None to disable cap.
    """
    client = get_supabase()
    client_id = get_client_id()
    city_id_str = str(city_id)

    # Ensure timestampDt is set
    def _ensure_ts_dt(p: dict[str, Any]) -> None:
        if p.get("timestampDt") is None:
            dt = _parse_iso(p.get("timestamp"))
            if dt is not None:
                p["timestampDt"] = dt.isoformat()

    for p in posts:
        try:
            _ensure_ts_dt(p)
        except Exception:
            pass

    # Sort by timestamp descending
    def _ts_key(p: dict[str, Any]):
        v = p.get("timestampDt") or p.get("timestamp") or ""
        try:
            if hasattr(v, "isoformat"):
                return v.isoformat()
            return str(v)
        except Exception:
            return ""

    # Deduplicate posts
    def _canon_url(u: Any) -> str:
        try:
            s = str(u or "").strip()
            if not s:
                return ""
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
                cap_str = str(p.get("caption") or "").strip()
                cap_key = cap_str[:64]
                key = f"tscap:{platform}:{ts_val}:{cap_key}"
            if key in seen:
                continue
            seen.add(key)
            deduped.append(p)
        except Exception:
            deduped.append(p)

    posts = deduped

    try:
        posts = sorted(posts, key=_ts_key, reverse=True)
    except Exception:
        pass

    # Delete existing posts for this city
    client.from_("speed_posts").delete().eq("clientId", client_id).eq(
        "cityId", city_id_str
    ).execute()
    print(f"[Supabase] City {city_id}: deleted existing posts")

    # Add new posts (respect cap)
    to_write = posts if cap is None else posts[:cap]
    if not to_write:
        print(f"[Supabase] City {city_id}: nothing to write (cap={cap})")
        return

    # Prepare records for insert
    records = []
    for p in to_write:
        records.append(
            {
                "clientId": client_id,
                "cityId": city_id_str,
                "platform": p.get("platform"),
                "postId": p.get("id") or p.get("postId"),
                "username": p.get("username"),
                "caption": p.get("caption"),
                "mediaUrl": p.get("mediaUrl"),
                "imageUrl": p.get("imageUrl"),
                "avatarUrl": p.get("avatarUrl"),
                "likeCount": p.get("likeCount") or p.get("likes") or 0,
                "timestamp": _parse_timestamp_iso(p.get("timestamp")),
                "timestampDt": _parse_timestamp_iso(
                    p.get("timestampDt") or p.get("timestamp")
                ),
                "url": p.get("url"),
            }
        )

    # Batch insert (Supabase handles large inserts)
    client.from_("speed_posts").insert(records).execute()
    print(f"[Supabase] City {city_id}: wrote {len(records)} posts")


def list_city_posts(city_id: int) -> list[dict[str, Any]]:
    """List all posts for a city."""
    client = get_supabase()
    client_id = get_client_id()

    result = (
        client.from_("speed_posts")
        .select("*")
        .eq("clientId", client_id)
        .eq("cityId", str(city_id))
        .order("timestampDt", desc=True)
        .execute()
    )

    return [dict(row) | {"id": row.get("id")} for row in result.data or []]


def repartition_posts_across_cities(*, cap: Optional[int] = 100) -> dict[str, Any]:
    """Reassign posts into each city based on city start times.

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

    # Helper: find target city for a timestamp
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
            tgt = original_city_id
        if tgt != original_city_id:
            moved += 1
            moved_by_city[tgt] = moved_by_city.get(tgt, 0) + 1
        per_city.setdefault(tgt, []).append(post)

    # Persist per city
    for cid, posts in per_city.items():
        save_city_posts(cid, posts, cap=cap)

    print(f"[Repartition] Moved {moved} posts. Per-city moved: {moved_by_city}")
    return {
        "changed": True,
        "moved": moved,
        "cities": {str(k): len(v) for k, v in per_city.items()},
        "movedByCity": {str(k): v for k, v in moved_by_city.items()},
    }


# ------------------ Settings ------------------


DEFAULT_SETTINGS = {
    "socialScrapeIntervalMin": 5,
    "schedulerEnabled": True,
    "instagramUsername": "",
    "twitterUsername": "",
    "tiktokUsername": "",
    "twitchUsername": "",
    "youtubeUsername": "",
    "socialHashtag": "SpeedDoesAmerica",
    "curatorApiBase": "",
    "curatorApiKey": "",
    "curatorFeedId": "",
    "curatorJsonUrl": "",
    "disableMerch": False,
    "sleepHideUserBar": False,
    "departureTime": "22:00",
    "departureTimeUtc": 1320,
}


def get_settings() -> dict[str, Any]:
    """Fetch settings with env overrides."""
    client = get_supabase()
    client_id = get_client_id()

    data = {}
    try:
        result = (
            client.from_("speed_settings")
            .select("*")
            .eq("clientId", client_id)
            .execute()
        )
        if result and hasattr(result, 'data') and result.data:
            # Take first result if multiple (shouldn't happen due to unique constraint)
            data = result.data[0] if isinstance(result.data, list) else result.data
    except Exception:
        # Table might not exist yet or be empty
        pass

    # Environment overrides (do not include secrets in response)
    env_overrides: dict[str, Any] = {}
    if os.getenv("CURATOR_JSON_URL"):
        env_overrides["curatorJsonUrl"] = os.getenv("CURATOR_JSON_URL")
    if os.getenv("CURATOR_API_BASE"):
        env_overrides["curatorApiBase"] = os.getenv("CURATOR_API_BASE")
    if os.getenv("CURATOR_FEED_ID"):
        env_overrides["curatorFeedId"] = os.getenv("CURATOR_FEED_ID")

    return {**DEFAULT_SETTINGS, **data, **env_overrides}


def update_settings(data: dict[str, Any]) -> dict[str, Any]:
    """Update settings."""
    client = get_supabase()
    client_id = get_client_id()

    # Never persist API key via settings to avoid accidental exposure
    if "curatorApiKey" in data:
        data = {k: v for k, v in data.items() if k != "curatorApiKey"}

    data["clientId"] = client_id
    data["id"] = "globals"
    data["updatedAt"] = datetime.now(timezone.utc).isoformat()

    client.from_("speed_settings").upsert(data, on_conflict="clientId").execute()
    return get_settings()


# ------------------ Merch ------------------


def list_merch() -> list[dict[str, Any]]:
    """List all merch items."""
    client = get_supabase()
    client_id = get_client_id()

    result = client.from_("speed_merch").select("*").eq("clientId", client_id).execute()

    return [dict(row) for row in result.data or []]


def create_merch(data: dict[str, Any]) -> dict[str, Any]:
    """Create a new merch item."""
    client = get_supabase()
    client_id = get_client_id()

    data["clientId"] = client_id
    data["createdAt"] = datetime.now(timezone.utc).isoformat()
    data["updatedAt"] = datetime.now(timezone.utc).isoformat()

    result = client.from_("speed_merch").insert(data).execute()
    return result.data[0] if result.data else data


def update_merch(item_id: str, data: dict[str, Any]) -> dict[str, Any]:
    """Update a merch item."""
    client = get_supabase()
    client_id = get_client_id()

    data["updatedAt"] = datetime.now(timezone.utc).isoformat()

    result = (
        client.from_("speed_merch")
        .update(data)
        .eq("clientId", client_id)
        .eq("id", item_id)
        .execute()
    )

    return result.data[0] if result.data else data


# ------------------ Sleep flag ------------------


def get_sleep_flag() -> bool:
    """Return current sleep flag from status."""
    doc = get_status()
    return bool(doc.get("isSleep")) if doc else False


def get_sleep_state() -> dict[str, Any]:
    """Return current sleep/traveling flags from status.

    Shape: { "isSleep": bool, "isTraveling": bool }
    """
    doc = get_status() or {}
    return {
        "isSleep": bool(doc.get("isSleep")) if doc else False,
        "isTraveling": bool(doc.get("isTraveling")) if doc else False,
    }


def set_sleep_flag(is_sleep: bool) -> bool:
    """Set sleep flag and return new value."""
    update_status({"isSleep": is_sleep})
    return is_sleep


def set_sleep_state(
    *, is_sleep: bool | None = None, is_traveling: bool | None = None
) -> dict[str, Any]:
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


def compute_journey(tour_id: Optional[str] = None) -> dict[str, Any]:
    """Compute current journey state.

    If tour_id is None, defaults to America tour for backwards compatibility.
    """
    if tour_id is None:
        tour_id = "america"
    return compute_journey_for_tour(tour_id)

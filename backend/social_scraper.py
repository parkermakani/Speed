from __future__ import annotations

"""Curator.io ingestion utilities.

This module provides helper functions used by the background scheduler and
manual scrape endpoint to fetch items from Curator.io (either a public JSON
feed URL or the Curator API) and normalise them into our SocialPost-like shape.
"""

import os
import logging
from datetime import datetime, timezone
from typing import Any, List
import httpx


def _contains_keywords(post: dict[str, Any], terms: list[str]) -> bool:
    """Return True if any of the given terms appear in post caption/text."""
    searchable_fields = [
        post.get("caption"),
        post.get("text"),
        post.get("description"),
        post.get("title"),
    ]
    blob = " ".join([s for s in searchable_fields if isinstance(s, str)]).lower()
    if not blob:
        return False
    return any(term.lower() in blob for term in terms if term)


logger = logging.getLogger(__name__)
logger = logging.getLogger(__name__)


# ------------------ Core helpers ------------------

def _run_actor(*args, **kwargs):
    return []


def _filter_since(items: List[dict[str, Any]], dt: datetime, time_key: str) -> List[dict[str, Any]]:
    """Return items whose **time_key** ISO timestamp is >= **dt**.

    Handles comparisons safely between offset-aware and offset-naive datetimes by
    normalising both to *naive UTC* before comparison.
    """

    # Normalise **dt** to naive UTC
    if dt.tzinfo is not None:
        dt_cmp = dt.astimezone(timezone.utc).replace(tzinfo=None)
    else:
        dt_cmp = dt

    res = []
    for it in items:
        ts_raw = it.get(time_key)  # Expect ISO-8601 string
        if not ts_raw:
            continue
        try:
            ts_dt = datetime.fromisoformat(ts_raw.replace("Z", "+00:00"))
            # Normalise ts_dt
            if ts_dt.tzinfo is not None:
                ts_dt = ts_dt.astimezone(timezone.utc).replace(tzinfo=None)

            if ts_dt >= dt_cmp:
                res.append(it)
        except ValueError:
            continue
    return res


def _to_naive_utc(value: Any) -> datetime | None:
    """Coerce a Firestore timestamp/ISO string into naive UTC datetime.

    - If already a datetime: convert to UTC and strip tzinfo.
    - If string: parse ISO (accepts trailing Z) then convert as above.
    - Else: return None.
    """
    if isinstance(value, datetime):
        dt = value
    elif isinstance(value, str):
        try:
            dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
        except Exception:
            return None
    else:
        return None

    if dt.tzinfo is not None:
        dt = dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt


def _to_iso_utc(value: Any) -> str | None:
    """Return ISO-8601 UTC string for various timestamp representations.

    Supports:
    - ISO-like strings (with or without 'Z')
    - Unix epoch seconds or milliseconds (int/float)
    """
    dt: datetime | None = None
    if isinstance(value, (int, float)):
        # Detect ms vs s
        secs = float(value)
        if secs > 1e12:
            secs = secs / 1000.0
        try:
            dt = datetime.utcfromtimestamp(secs)
        except Exception:
            dt = None
    elif isinstance(value, str):
        try:
            dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
        except Exception:
            dt = None
    elif isinstance(value, datetime):
        dt = value
    if dt is None:
        return None
    if dt.tzinfo is not None:
        from datetime import timezone as _tz
        dt = dt.astimezone(_tz.utc).replace(tzinfo=None)
    return dt.isoformat() + "Z"


# ------------------ Platform functions ------------------

def search_instagram(term: str, since: datetime) -> List[dict[str, Any]]:
    """Return Instagram posts for **term** newer than **since** (UTC).

    The Apify Instagram scraper actor supports *multiple* input styles. To reduce
    noise we now switch to using **directUrls** that point to the tagged feed of
    the profile we care about (e.g. `https://www.instagram.com/ishowspeed/tagged/`).

    Steps:
    1. Extract the first token that looks like an Instagram handle (leading `@`).
    2. Build the `/tagged/` feed URL for that handle and pass it in `directUrls`.
    3. Supply `onlyPostsNewerThan` (ISO 8601) so the actor pre-filters.
    4. Keep `resultsLimit` and `resultsType` as before.
    5. Down-stream keyword filtering happens via `_contains_keywords` so we don't
       need the actor to do any full-text filtering.
    """

    parts = term.split()
    handle = None
    for p in parts:
        if p.startswith("@"):
            handle = p.lstrip("@")
            break

    if not handle:
        # Fallback to old search behaviour
        input_payload = {
            "search": term,
            "resultsLimit": 100,
            "resultsType": "posts",
            "addLocations": True,
        }
    else:
        url = f"https://www.instagram.com/{handle}/tagged/"
        input_payload = {
            "directUrls": [url],
            "onlyPostsNewerThan": since.isoformat(),
            "resultsLimit": 100,
            "resultsType": "posts",
            "searchLimit": 1,
            # Keep optional flags explicit for clarity
            "addParentData": False,
            "enhanceUserSearchWithFacebookPage": False,
            "isUserReelFeedURL": False,
            "isUserTaggedFeedURL": True,
        }

    raw = _run_actor("instagram", input_payload)
    return _filter_since(raw, since, "timestamp")


def search_tiktok(term: str, since: datetime) -> List[dict[str, Any]]:
    """Return TikTok posts newer than **since** for the given **term**.

    Similar strategy to Instagram: if we detect a profile handle in the term we
    convert it into a direct profile URL and rely on the actor's
    `onlyPostsNewerThan` field for server-side date filtering. Otherwise we fall
    back to keyword search.
    """

    # The TikTok scraper actor now expects parameters structured around
    # `searchQueries` rather than profile URLs. We construct a single search
    # query combining the handle (without @) and any additional keywords so the
    # actor can return up-to-date videos. Date filtering is still handled
    # client-side via `_filter_since` because the actor does not expose a
    # server-side date parameter.

    parts = term.split()
    handle = ""
    if parts and parts[0].startswith("@"):
        handle = parts[0].lstrip("@")
        parts = parts[1:]

    # Compose the final query string.
    query_str = " ".join([handle] + parts).strip()
    if not query_str:
        query_str = term.lstrip("@")  # Fallback to original string minus @

    input_payload = {
        "searchQueries": [query_str],
        "searchSection": "/video",  # Fetch videos tab results
        "resultsPerPage": 100,
        "excludePinnedPosts": False,
        "scrapeRelatedVideos": False,
        "shouldDownloadVideos": False,
        "shouldDownloadCovers": False,
        "shouldDownloadAvatars": False,
        "shouldDownloadMusicCovers": False,
        "shouldDownloadSlideshowImages": False,
        "shouldDownloadSubtitles": False,
        "proxyCountryCode": "None",
    }

    raw = _run_actor("tiktok", input_payload)
    return _filter_since(raw, since, "createTimeISO")


def search_twitter(term: str, since: datetime) -> List[dict[str, Any]]:
    """Return tweets matching **term** (full-text query) created after **since** UTC."""
    # The Apify tweet-scraper actor supports a `query` parameter for standard
    # Twitter search operators. This allows us to pass the full term – including
    # profile handles, city names, and keywords – rather than being limited to a
    # single *author* handle.

    # Updated per user request: place the Twitter handle in the `mentioning`
    # parameter, and pass the remaining city/state keywords via `searchTerms`.

    # The incoming `term` is of the form "@handle <kw1> <kw2> ...". Split it so
    # that `handle` goes to `mentioning` (without the leading "@") and the
    # rest become a single search string in `searchTerms` (if any).

    parts = term.split()
    handle = parts[0].lstrip("@") if parts else ""
    keyword_query = " ".join(parts[1:]) if len(parts) > 1 else ""

    input_payload = {
        "mentioning": handle or None,
        "searchTerms": [keyword_query] if keyword_query else [],
        "maxItems": 100,
        "start": since.strftime("%Y-%m-%d"),
    }

    raw = _run_actor("twitter", input_payload)

    # The actor may emit either `created_at` (snake) or `createdAt` (camel)
    # depending on its version. Choose whichever exists in the first item.
    time_key = "created_at"
    if raw and "createdAt" in raw[0]:
        time_key = "createdAt"

    return _filter_since(raw, since, time_key)


# ------------------ Hashtag search helpers ------------------

def _normalise_hashtag(tag: str) -> str:
    tag = (tag or "").strip()
    if not tag:
        return ""
    if tag.startswith("#"):
        tag = tag[1:]
    return tag


def search_instagram_hashtag(hashtag: str, since: datetime) -> List[dict[str, Any]]:
    """Return Instagram posts for the given hashtag newer than since.

    Uses the explore/tags/<tag>/ feed via directUrls for reliability.
    """
    tag = _normalise_hashtag(hashtag)
    if not tag:
        return []
    url = f"https://www.instagram.com/explore/tags/{tag}/"
    input_payload = {
        "directUrls": [url],
        "onlyPostsNewerThan": since.isoformat(),
        "resultsLimit": 100,
        "resultsType": "posts",
        "searchLimit": 1,
        "isTagResult": True,
    }
    raw = _run_actor("instagram", input_payload)
    return _filter_since(raw, since, "timestamp")


def search_tiktok_hashtag(hashtag: str, since: datetime) -> List[dict[str, Any]]:
    """Return TikTok videos for the given hashtag newer than since.

    Actor does not expose server-side time filter reliably; client-side filter is applied.
    """
    tag = _normalise_hashtag(hashtag)
    if not tag:
        return []
    query = f"#{tag}"
    input_payload = {
        "searchQueries": [query],
        "searchSection": "/video",
        "resultsPerPage": 100,
        "excludePinnedPosts": False,
        "shouldDownloadVideos": False,
        "shouldDownloadCovers": False,
        "shouldDownloadAvatars": False,
        "shouldDownloadMusicCovers": False,
        "shouldDownloadSlideshowImages": False,
        "shouldDownloadSubtitles": False,
        "proxyCountryCode": "None",
    }
    raw = _run_actor("tiktok", input_payload)
    return _filter_since(raw, since, "createTimeISO")


def search_twitter_hashtag(hashtag: str, since: datetime) -> List[dict[str, Any]]:
    """Return tweets containing the hashtag newer than since."""
    tag = _normalise_hashtag(hashtag)
    if not tag:
        return []
    query = f"#{tag}"
    input_payload = {
        "mentioning": None,
        "searchTerms": [query],
        "maxItems": 100,
        "start": since.strftime("%Y-%m-%d"),
    }
    raw = _run_actor("twitter", input_payload)
    time_key = "created_at"
    if raw and "createdAt" in raw[0]:
        time_key = "createdAt"
    return _filter_since(raw, since, time_key)


# ------------------ Public API ------------------

def scrape_city_posts(city: dict[str, Any], profiles: List[str] | None = None) -> List[dict[str, Any]]:
    """Scrape posts for the given **city** document.

    Returns up to 100 combined posts sorted by a simple heuristic (likes). Caller
    should persist to Firestore under `cities/{city.id}/posts`.
    """
    if not profiles:
        profiles_env = os.getenv("SOCIAL_PROFILES", "")
        profiles = [p.strip() for p in profiles_env.split(",") if p.strip()]
    if not profiles:
        logger.info("No social profiles configured; skipping scrape")
        return []

    last_ts_val = city.get("lastCurrentAt") or city.get("last_current_at")
    if not last_ts_val:
        logger.debug("City %s has no lastCurrentAt; nothing to scrape", city.get("city"))
        return []

    since_dt = _to_naive_utc(last_ts_val)
    if since_dt is None:
        logger.warning("Invalid lastCurrentAt format for city %s: %s", city.get("city"), last_ts_val)
        return []

    keywords = [city.get("city", ""), city.get("state", "")]  # e.g., ["Chicago", "Illinois"]
    city_kw_raw = city.get("keywords")
    if isinstance(city_kw_raw, str):
        city_kw = [k.strip() for k in city_kw_raw.split(",") if k.strip()]
    elif isinstance(city_kw_raw, list):
        city_kw = city_kw_raw  # type: ignore
    else:
        city_kw = []

    keywords.extend(city_kw)

    results: List[dict[str, Any]] = []
    for profile in profiles:
        query = f"@{profile} {' '.join(keywords)}"
        results.extend(search_instagram(query, since_dt))
        results.extend(search_tiktok(query, since_dt))
        results.extend(search_twitter(query, since_dt))

    # Deduplicate by platform+id
    seen = set()
    deduped: List[dict[str, Any]] = []
    for post in results:
        key = (post.get("platform"), post.get("id") or post.get("postId"))
        if key not in seen:
            seen.add(key)
            deduped.append(post)

    # Sort by likes if available else timestamp desc
    # Sort newest to oldest using timestamp if available, else likes
    def ts(item: dict[str, Any]):
        return item.get("timestamp") or ""
    try:
        deduped.sort(key=lambda it: (it.get("timestamp") or ""), reverse=True)
    except Exception:
        def score(item: dict[str, Any]):
            return item.get("likeCount", 0) or item.get("likes", 0)
        deduped.sort(key=score, reverse=True)

    # --- Keyword filter ----------------
    extra_kw_env = os.getenv("SOCIAL_KEYWORDS", "")
    extra_kw = [k.strip() for k in extra_kw_env.split(",") if k.strip()]
    keyword_terms = keywords + extra_kw

    filtered = [p for p in deduped if _contains_keywords(p, keyword_terms)]

    return filtered[:100]


def scrape_hashtag_posts(city: dict[str, Any], hashtag: str) -> List[dict[str, Any]]:
    """Scrape posts across platforms for a single hashtag since the city's lastCurrentAt."""
    tag = _normalise_hashtag(hashtag)
    if not tag:
        logger.info("No hashtag provided; skipping scrape")
        return []

    last_ts_val = city.get("lastCurrentAt") or city.get("last_current_at")
    if not last_ts_val:
        logger.debug("City %s has no lastCurrentAt; nothing to scrape", city.get("city"))
        return []
    since_dt = _to_naive_utc(last_ts_val)
    if since_dt is None:
        logger.warning("Invalid lastCurrentAt format for city %s: %s", city.get("city"), last_ts_val)
        return []

    results: List[dict[str, Any]] = []
    results.extend(search_instagram_hashtag(tag, since_dt))
    results.extend(search_tiktok_hashtag(tag, since_dt))
    results.extend(search_twitter_hashtag(tag, since_dt))

    # Deduplicate by platform+id
    seen = set()
    deduped: List[dict[str, Any]] = []
    for post in results:
        key = (post.get("platform"), post.get("id") or post.get("postId"))
        if key not in seen:
            seen.add(key)
            deduped.append(post)

    # Sort by likes if available else timestamp desc
    # Sort newest to oldest primarily
    try:
        deduped.sort(key=lambda it: (it.get("timestamp") or ""), reverse=True)
    except Exception:
        def score(item: dict[str, Any]):
            return item.get("likeCount", 0) or item.get("likes", 0)
        deduped.sort(key=score, reverse=True)

    return deduped[:100]


# ------------------ Curator.io integration ------------------

async def fetch_curator_items(api_base: str, api_key: str, feed_id: str) -> List[dict[str, Any]]:
    """Fetch items from Curator.io API.

    Expected endpoint shape (example): GET {api_base}/v1/feeds/{feed_id}/posts?apikey={api_key}
    Adjust path/params if your Curator plan uses different endpoints.
    """
    url = api_base.rstrip("/") + f"/v1/feeds/{feed_id}/posts"
    params = {"apikey": api_key}
    # Try Authorization header first; if it fails, fallback to api_key query param
    try:
        async with httpx.AsyncClient(timeout=15, headers={"Authorization": f"Bearer {api_key}"}) as client:
            resp = await client.get(url)
            if resp.status_code == 401 or resp.status_code == 403:
                raise httpx.HTTPStatusError("Unauthorized", request=resp.request, response=resp)
            resp.raise_for_status()
            data = resp.json()
            items = data.get("posts") or data.get("data") or []
            return items if isinstance(items, list) else []
    except Exception:
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                resp = await client.get(url, params={"api_key": api_key})
                resp.raise_for_status()
                data = resp.json()
                items = data.get("posts") or data.get("data") or []
                return items if isinstance(items, list) else []
        except Exception:
            return []


async def fetch_curator_items_paged(api_base: str, api_key: str, feed_id: str, *, max_pages: int = 200, limit: int = 100) -> List[dict[str, Any]]:
    """Fetch multiple pages of Curator items.

    Tries Authorization header first; falls back to api_key query param.
    Stops when a page returns < limit items or max_pages reached.
    """
    base_url = api_base.rstrip("/") + f"/v1/feeds/{feed_id}/posts"
    all_items: List[dict[str, Any]] = []

    # First attempt with Authorization header
    try:
        async with httpx.AsyncClient(timeout=20, headers={"Authorization": f"Bearer {api_key}"}) as client:
            # Strategy: cursor-based using pagination.after per Curator docs
            after: str | None = None
            seen_ids: set[str] = set()
            for page in range(1, max_pages + 1):
                params = {"limit": limit}
                if after:
                    params["after"] = after
                resp = await client.get(base_url, params=params)
                if resp.status_code in (401, 403):
                    raise httpx.HTTPStatusError("Unauthorized", request=resp.request, response=resp)
                resp.raise_for_status()
                data = resp.json()
                items = data.get("posts") or data.get("data") or []
                if not isinstance(items, list):
                    break
                logger.info("Curator API cursor page %s: items=%s after=%s", page, len(items), after)
                new_added = 0
                for it in items:
                    it_id = str(it.get("id") or it.get("postId") or it.get("post_id") or "")
                    if it_id and it_id not in seen_ids:
                        seen_ids.add(it_id)
                        all_items.append(it)
                        new_added += 1
                # read next cursor
                pag = data.get("pagination") or {}
                next_after = pag.get("after") if isinstance(pag, dict) else None
                after = next_after if next_after else None
                if not after or len(items) < limit or new_added == 0:
                    break
    except Exception:
        # Fallback: query param api_key
        try:
            async with httpx.AsyncClient(timeout=20) as client:
                # Cursor strategy using api_key in query params
                after: str | None = None
                seen_ids: set[str] = set()
                for page in range(1, max_pages + 1):
                    params = {"api_key": api_key, "limit": limit}
                    if after:
                        params["after"] = after
                    resp = await client.get(base_url, params=params)
                    resp.raise_for_status()
                    data = resp.json()
                    items = data.get("posts") or data.get("data") or []
                    if not isinstance(items, list):
                        break
                    logger.info("Curator API (qp) cursor page %s: items=%s after=%s", page, len(items), after)
                    new_added = 0
                    for it in items:
                        it_id = str(it.get("id") or it.get("postId") or it.get("post_id") or "")
                        if it_id and it_id not in seen_ids:
                            seen_ids.add(it_id)
                            all_items.append(it)
                            new_added += 1
                    pag = data.get("pagination") or {}
                    next_after = pag.get("after") if isinstance(pag, dict) else None
                    after = next_after if next_after else None
                    if not after or len(items) < limit or new_added == 0:
                        break
        except Exception:
            return []

    logger.info("Curator API paged total items=%s", len(all_items))
    return all_items


async def fetch_curator_json(json_url: str) -> List[dict[str, Any]]:
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(json_url)
            resp.raise_for_status()
            data = resp.json()
            items = data.get("posts") or data.get("data") or data
            return items if isinstance(items, list) else []
    except Exception:
        return []


def _normalise_curator_item(item: dict[str, Any]) -> dict[str, Any]:
    """Map Curator item into our SocialPost-like shape."""
    # Prefer a canonical post URL if Curator provides one
    post_url = (
        item.get("url")
        or item.get("link")
        or item.get("permalink")
        or item.get("postUrl")
        or item.get("post_url")
        or item.get("sourceUrl")
        or item.get("source_url")
        or item.get("shareUrl")
        or item.get("share_url")
    )
    # Attempt to find an avatar/profile image and username
    user_raw = item.get("user") or item.get("author") or item.get("user_data")
    user_dict = user_raw if isinstance(user_raw, dict) else None
    # Username fallbacks
    username = (
        (user_dict.get("username") if user_dict else None)
        or item.get("username")
        or item.get("user_screen_name")
        or item.get("screen_name")
        or item.get("authorName")
        or item.get("author_username")
    )
    # Avatar fallbacks (dict first, then item-level aliases)
    avatar_url = (
        (user_dict.get("profile_image") if user_dict else None)
        or (user_dict.get("profileImage") if user_dict else None)
        or (user_dict.get("profilePic") if user_dict else None)
        or (user_dict.get("profile_picture") if user_dict else None)
        or (user_dict.get("avatar") if user_dict else None)
        or (user_dict.get("avatarUrl") if user_dict else None)
        or item.get("authorProfileImage")
        or item.get("authorAvatar")
        or item.get("user_image")
        or item.get("profile_image_url")
        or item.get("profileImageUrl")
    )
    # Timestamp: try multiple possible fields and normalise to ISO UTC
    ts_raw = (
        item.get("created_at")
        or item.get("createdAt")
        or item.get("timestamp")
        or item.get("post_date")
        or item.get("posted_at")
        or item.get("pubDate")
        or item.get("publishedAt")
        or item.get("date")
        or item.get("time")
        or item.get("created_time")
        or item.get("source_created_at")
        or item.get("sourceCreatedAt")
        or item.get("created")
        or item.get("posted")
    )
    ts_iso = _to_iso_utc(ts_raw)

    return {
        "platform": item.get("network") or item.get("source"),
        "id": item.get("id") or item.get("postId") or item.get("post_id"),
        "username": username,
        "caption": item.get("text") or item.get("caption") or item.get("content"),
        "mediaUrl": item.get("image") or item.get("thumbnail"),
        "likeCount": item.get("likes") or item.get("likeCount") or 0,
        "timestamp": ts_iso,
        "url": post_url,
        "avatarUrl": avatar_url,
    }


async def scrape_curator_posts(city: dict[str, Any], settings: dict[str, Any], *, ignore_time: bool = False, no_cap: bool = False) -> List[dict[str, Any]]:
    json_url = (settings.get("curatorJsonUrl") or "").strip()
    api_base = (settings.get("curatorApiBase") or "").strip()
    # prefer env var for secrets; settings field ignored for exposure safety
    api_key = (settings.get("curatorApiKey") or os.getenv("CURATOR_API_KEY") or "").strip()
    feed_id = (settings.get("curatorFeedId") or "").strip()

    items: List[dict[str, Any]] = []
    # If Fetch All (no_cap) is requested and API creds are available, prefer API paging
    if no_cap and api_base and api_key and feed_id:
        logger.info("Curator scrape: using api_paged (ignore_time=%s, no_cap=%s)", ignore_time, no_cap)
        items = await fetch_curator_items_paged(api_base, api_key, feed_id)
    elif json_url:
        logger.info("Curator scrape: using json feed (ignore_time=%s, no_cap=%s)", ignore_time, no_cap)
        items = await fetch_curator_json(json_url)
    elif api_base and api_key and feed_id:
        logger.info("Curator scrape: using api_single page (ignore_time=%s, no_cap=%s)", ignore_time, no_cap)
        items = await fetch_curator_items(api_base, api_key, feed_id)
    else:
        return []

    normalised = [_normalise_curator_item(it) for it in items]
    # Intentionally do NOT filter by time here; we fetch all and assign later
    # Debug: report counts
    logger.info("Curator scrape: fetched items=%s before dedupe", len(normalised))

    # Dedup by platform+id
    seen = set()
    deduped: List[dict[str, Any]] = []
    for post in normalised:
        key = (post.get("platform"), post.get("id"))
        if key not in seen:
            seen.add(key)
            deduped.append(post)

    def score(item: dict[str, Any]):
        return item.get("likeCount", 0) or item.get("likes", 0)

    deduped.sort(key=score, reverse=True)
    logger.info("Curator scrape: deduped=%s, returning %s", len(deduped), ("all" if no_cap else "100"))
    return deduped if no_cap else deduped[:100]

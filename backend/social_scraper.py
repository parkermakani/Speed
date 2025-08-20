from __future__ import annotations

"""Utilities to fetch recent Instagram and TikTok posts via Apify.

This module provides helper functions that are *pure* network calls – no FastAPI
routes here. They can be imported by a scheduler/background task. Logic:

1. Determine the timestamp when the current city was activated (``lastCurrentAt``).
2. For each configured profile handle (``SOCIAL_PROFILES`` env, comma-separated),
   run Apify Instagram & TikTok actor searches for mentions newer than that time.
3. Combine, deduplicate, and score the results (basic likeCount/created order for now).
4. Caller (e.g. scheduler) is responsible for persisting results to Firestore.
"""

import os
import logging
from datetime import datetime
from typing import Any, List


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


try:
    from apify_client import ApifyClient  # type: ignore
except ImportError:  # Libraries may not be installed yet during CI
    ApifyClient = None  # type: ignore

logger = logging.getLogger(__name__)

APIFY_TOKEN = os.getenv("APIFY_TOKEN")
if not APIFY_TOKEN:
    logger.warning("APIFY_TOKEN not set – social scraping disabled")
    client = None
else:
    client = ApifyClient(APIFY_TOKEN) if ApifyClient else None

INSTAGRAM_ACTOR = os.getenv("APIFY_INSTAGRAM_ACTOR", "apify/instagram-scraper")
TIKTOK_ACTOR = os.getenv("APIFY_TIKTOK_ACTOR", "apify/tiktok-scraper")


# ------------------ Core helpers ------------------

def _run_actor(actor_id: str, run_input: dict[str, Any]) -> List[dict[str, Any]]:
    """Invoke an Apify actor and return its dataset items list."""
    if not client:
        logger.debug("Apify client not initialised; returning empty results")
        return []

    try:
        run = client.actor(actor_id).call(run_input=run_input)
        dataset_id = run["defaultDatasetId"]
        items: List[dict[str, Any]] = list(client.dataset(dataset_id).iterate_items())
        logger.debug("Fetched %s items from actor %s", len(items), actor_id)
        return items
    except Exception as exc:
        logger.error("Apify actor %s failed: %s", actor_id, exc)
        return []


def _filter_since(items: List[dict[str, Any]], dt: datetime, time_key: str) -> List[dict[str, Any]]:
    res = []
    for it in items:
        ts_raw = it.get(time_key)  # Expect ISO string
        if not ts_raw:
            continue
        try:
            ts = datetime.fromisoformat(ts_raw.replace("Z", "+00:00"))
            if ts >= dt:
                res.append(it)
        except ValueError:
            continue
    return res


# ------------------ Platform functions ------------------

def search_instagram(term: str, since: datetime) -> List[dict[str, Any]]:
    """Return Instagram posts mentioning **term** created after **since** UTC."""
    input_payload = {
        "search": term,
        "resultsLimit": 100,
        "resultsType": "recent",  # Apify IG actor param
        "addLocations": True,
    }
    raw = _run_actor(INSTAGRAM_ACTOR, input_payload)
    return _filter_since(raw, since, "timestamp")


def search_tiktok(term: str, since: datetime) -> List[dict[str, Any]]:
    """Return TikTok posts mentioning **term** created after **since** UTC."""
    input_payload = {
        "search": term,
        "resultsLimit": 100,
        "resultsType": "recent",
    }
    raw = _run_actor(TIKTOK_ACTOR, input_payload)
    return _filter_since(raw, since, "createTimeISO")


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

    last_ts_str = city.get("lastCurrentAt") or city.get("last_current_at")
    if not last_ts_str:
        logger.debug("City %s has no lastCurrentAt; nothing to scrape", city.get("city"))
        return []

    try:
        since_dt = datetime.fromisoformat(last_ts_str.replace("Z", "+00:00"))
    except ValueError:
        logger.warning("Invalid lastCurrentAt format for city %s: %s", city.get("city"), last_ts_str)
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

    # Deduplicate by platform+id
    seen = set()
    deduped: List[dict[str, Any]] = []
    for post in results:
        key = (post.get("platform"), post.get("id") or post.get("postId"))
        if key not in seen:
            seen.add(key)
            deduped.append(post)

    # Sort by likes if available else timestamp desc
    def score(item: dict[str, Any]):
        return item.get("likeCount", 0) or item.get("likes", 0)

    deduped.sort(key=score, reverse=True)

    # --- Keyword filter ----------------
    extra_kw_env = os.getenv("SOCIAL_KEYWORDS", "")
    extra_kw = [k.strip() for k in extra_kw_env.split(",") if k.strip()]
    keyword_terms = keywords + extra_kw

    filtered = [p for p in deduped if _contains_keywords(p, keyword_terms)]

    return filtered[:100]

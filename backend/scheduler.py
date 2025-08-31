from __future__ import annotations

"""AsyncIO background scheduler for social media scraping tasks."""

import os
import asyncio
import logging
from datetime import datetime

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger

from backend import firestore_repo as repo

from backend import social_scraper

logger = logging.getLogger(__name__)


def _current_interval_min() -> int:
    settings = repo.get_settings()
    return int(settings.get("socialScrapeIntervalMin", 60))


async def scrape_current_city_job():
    """Job: scrape posts for the current city and store to Firestore."""
    cities = repo.list_cities()
    current = next((c for c in cities if c.get("isCurrent")), None)
    if not current:
        logger.info("No current city found – skipping scrape job")
        return

    logger.info("Running social scrape for city %s (%s)", current.get("city"), datetime.utcnow())
    settings = repo.get_settings()

    # Curator-only: prefer Curator JSON, else Curator API (key may be via env)
    curator_json = (settings.get("curatorJsonUrl") or "").strip()
    curator_api_base = (settings.get("curatorApiBase") or "").strip()
    curator_feed_id = (settings.get("curatorFeedId") or "").strip()
    curator_enabled = bool(curator_json or (curator_api_base and curator_feed_id))
    if not curator_enabled:
        logger.info("Curator not configured; skipping scrape job")
        return
    posts = await social_scraper.scrape_curator_posts(current, settings)  # type: ignore
    if posts:
        repo.save_city_posts(current["id"], posts)
        # After saving, repartition across cities so window assignment happens centrally
        try:
            repo.repartition_posts_across_cities()
        except Exception:
            pass
        logger.info("Saved %d posts for city %s", len(posts), current.get("city"))
    else:
        logger.info("No posts captured for city %s", current.get("city"))

    # Record last run status
    global _last_run_at, _last_run_city_id, _last_run_saved_count
    _last_run_at = datetime.utcnow().isoformat()
    _last_run_city_id = current["id"]
    _last_run_saved_count = len(posts or [])


_scheduler: AsyncIOScheduler | None = None
_last_run_at: str | None = None
_last_run_city_id: int | None = None
_last_run_saved_count: int | None = None


def _reschedule():
    if _scheduler is None:
        return
    interval = _current_interval_min()
    # remove existing job if exists
    try:
        _scheduler.remove_job("social-scrape")
    except Exception:
        pass
    _scheduler.add_job(scrape_current_city_job, IntervalTrigger(minutes=interval), id="social-scrape", replace_existing=True)
    logger.info("Scheduler interval set to %d min", interval)


def start_scheduler() -> None:
    global _scheduler
    if _scheduler is not None:
        return

    interval = _current_interval_min()
    if interval <= 0:
        logger.warning("SOCIAL_SCRAPE_INTERVAL_MIN <= 0; scheduler disabled")
        return

    _scheduler = AsyncIOScheduler()
    _scheduler.start()
    _reschedule()


def get_status() -> dict:
    """Return scheduler and scrape configuration status for diagnostics."""
    settings = repo.get_settings()
    curator_json = (settings.get("curatorJsonUrl") or "").strip()
    curator_api_base = (settings.get("curatorApiBase") or "").strip()
    curator_feed_id = (settings.get("curatorFeedId") or "").strip()
    curator_enabled = bool(curator_json or (curator_api_base and curator_feed_id))

    interval = _current_interval_min()
    cities = repo.list_cities()
    current = next((c for c in cities if c.get("isCurrent")), None)
    return {
        "enabled": _scheduler is not None and interval > 0,
        "intervalMin": interval,
        "currentCityId": current.get("id") if current else None,
        "currentCity": current.get("city") if current else None,
        "curatorEnabled": curator_enabled,
        "lastRunAt": _last_run_at,
        "lastRunCityId": _last_run_city_id,
        "lastRunSavedCount": _last_run_saved_count,
    }


def reload_settings():
    """Call when settings updated to refresh scheduler interval."""
    _reschedule()

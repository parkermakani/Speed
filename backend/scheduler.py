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


async def update_travel_position_job():
    """When Sleep + Traveling are enabled, update status lat/lng toward next city.

    Interpolates between current city's lastCurrentAt and next city's lastCurrentAt.
    If next city's start time is not set, does nothing.
    """
    try:
        sleep_state = repo.get_sleep_state()
        if not (sleep_state.get("isSleep") and sleep_state.get("isTraveling")):
            return
        j = repo.compute_journey()
        current = j.get("currentCity") or {}
        nxt = j.get("nextCity") or None
        if not current or not nxt:
            return
        from datetime import datetime as _dt
        def _parse_iso(val):
            try:
                return _dt.fromisoformat(str(val).replace("Z", "+00:00")).replace(tzinfo=None)
            except Exception:
                return None
        start_cur = _parse_iso(current.get("lastCurrentAt") or current.get("last_current_at"))
        start_next = _parse_iso(nxt.get("lastCurrentAt") or nxt.get("last_current_at"))
        if not (start_cur and start_next):
            return
        # Compute TODAY's departure timestamp (UTC) using universal departureTime (HH:MM)
        settings = repo.get_settings()
        # Use minutes since midnight UTC for consistent server-side math.
        dep_min_utc = settings.get("departureTimeUtc")
        if isinstance(dep_min_utc, int) and 0 <= dep_min_utc < 1440:
            dep_hour = dep_min_utc // 60
            dep_min = dep_min_utc % 60
        else:
            dep_str = str(settings.get("departureTime") or "22:00").strip()
            try:
                hh, mm = dep_str.split(":")
                dep_hour = int(hh)
                dep_min = int(mm)
            except Exception:
                dep_hour = 22
                dep_min = 0
        now = _dt.utcnow().replace(tzinfo=None)
        # Align departure to the arrival date in UTC then adjust day if after arrival
        dep_dt = start_next.replace(hour=dep_hour, minute=dep_min, second=0, microsecond=0)
        if dep_dt > start_next:
            from datetime import timedelta as _td
            dep_dt = dep_dt - _td(days=1)
        # Progress window is [dep_dt, start_next]
        total = (start_next - dep_dt).total_seconds()
        if total <= 0:
            return
        # If we're before departure, keep at origin
        if now <= dep_dt:
            f = 0.0
        elif now >= start_next:
            f = 1.0
        else:
            elapsed = (now - dep_dt).total_seconds()
            f = max(0.0, min(1.0, elapsed / total))
        try:
            clat = float(current.get("lat") or 0.0)
            clng = float(current.get("lng") or 0.0)
            nlat = float(nxt.get("lat") or 0.0)
            nlng = float(nxt.get("lng") or 0.0)
        except Exception:
            return
        lat = clat + (nlat - clat) * f
        lng = clng + (nlng - clng) * f
        # Update status; do not change city/state/quote here
        repo.update_status({"lat": lat, "lng": lng})
    except Exception:
        # Non-fatal; skip this tick
        return


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
    # Travel position updater runs on a fixed cadence (e.g., every 5 minutes)
    try:
        _scheduler.add_job(update_travel_position_job, IntervalTrigger(minutes=5), id="travel-update", replace_existing=True)
    except Exception:
        pass


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

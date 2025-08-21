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
    profiles = []
    if settings.get("instagramUsername"):
        profiles.append(settings["instagramUsername"])
    if settings.get("twitterUsername"):
        profiles.append(settings["twitterUsername"])
    if settings.get("tiktokUsername"):
        profiles.append(settings["tiktokUsername"])
    logger.debug("Profiles to scrape: %s", profiles)

    posts = social_scraper.scrape_city_posts(current, profiles=profiles)
    if posts:
        repo.save_city_posts(current["id"], posts)
        logger.info("Saved %d posts for city %s", len(posts), current.get("city"))
    else:
        logger.info("No posts captured for city %s", current.get("city"))


_scheduler: AsyncIOScheduler | None = None


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


def reload_settings():
    """Call when settings updated to refresh scheduler interval."""
    _reschedule()

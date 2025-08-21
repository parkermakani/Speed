#!/usr/bin/env python
"""
Debug utility to manually invoke social media scraping for a city.

It auto-loads environment variables from a `.env` file at the repo root (if
`python-dotenv` is installed) so that `FIREBASE_SERVICE_ACCOUNT_JSON`,
`APIFY_TOKEN`, and other settings are available when running outside the normal
backend server context.
"""

from __future__ import annotations

import argparse
import logging
import os
import sys
from pathlib import Path
from typing import List, Any

# ---------------------------------------------------------------
# Ensure env vars from .env are loaded early **before** importing backend.
# ---------------------------------------------------------------

REPO_ROOT = Path(__file__).resolve().parents[2]

# Support `.env` in backend folder or project root.
BACKEND_ENV = REPO_ROOT / "backend" / ".env"
ROOT_ENV = REPO_ROOT / ".env"

try:
    from dotenv import load_dotenv  # type: ignore

    env_loaded = False
    for path in (BACKEND_ENV, ROOT_ENV):
        if path.exists():
            load_dotenv(path)
            env_loaded = True
            break

    if not env_loaded:
        # No .env found; rely on shell env
        pass
except ImportError:
    # python-dotenv optional; assume env already set in shell
    pass

# ---------------------------------------------------------------
# Make backend package importable
# ---------------------------------------------------------------

if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

# Now safe to import backend modules which rely on env vars

from backend import firestore_repo as repo  # type: ignore
from backend import social_scraper  # type: ignore

logging.basicConfig(level=logging.INFO, format="%(levelname)s:%(name)s:%(message)s")
parser_global = argparse.ArgumentParser(add_help=False)
parser_global.add_argument("--verbose", action="store_true", help="Enable debug logging")

args_pre, _ = parser_global.parse_known_args()
if args_pre.verbose:
    logging.getLogger().setLevel(logging.DEBUG)

logger = logging.getLogger("debug_scrape_city")


# ---------------------------------------------------------------
# Helper functions
# ---------------------------------------------------------------


def _profiles_from_settings(settings: dict[str, Any]) -> List[str]:
    profiles: List[str] = []
    if settings.get("instagramUsername"):
        profiles.append(settings["instagramUsername"])
    if settings.get("twitterUsername"):
        profiles.append(settings["twitterUsername"])
    return profiles


# ---------------------------------------------------------------
# Main CLI
# ---------------------------------------------------------------


def main() -> None:
    parser = argparse.ArgumentParser(description="Debug scrape social posts for a city", parents=[parser_global])
    parser.add_argument("--city", type=int, help="City document ID to scrape (defaults to current city)")
    args = parser.parse_args()

    if args.city is not None:
        city = repo.get_city(args.city)
        if not city:
            logger.error("City id %s not found in Firestore", args.city)
            sys.exit(1)
    else:
        cities = repo.list_cities()
        city = next((c for c in cities if c.get("isCurrent")), None)
        if not city:
            logger.error("No current city found; specify --city explicitly")
            sys.exit(1)

    settings = repo.get_settings()
    profiles = _profiles_from_settings(settings)
    logger.info("Scraping posts for city %s (id %s) using profiles %s", city.get("city"), city["id"], profiles)

    posts = social_scraper.scrape_city_posts(city, profiles=profiles)
    logger.info("Fetched %d posts", len(posts))

    for i, p in enumerate(posts[:10]):
        logger.info("%02d. [%s] @%s – %s", i + 1, p.get("platform"), p.get("username"), (p.get("caption") or p.get("text") or "")[:80])


if __name__ == "__main__":
    main()

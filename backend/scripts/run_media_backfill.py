from __future__ import annotations

"""Backfill script: cache media for existing Firestore posts and rewrite URLs.

Usage:
  python -m backend.scripts.run_media_backfill

Notes:
  - Requires Firebase Admin to be configured (FIREBASE_SERVICE_ACCOUNT_JSON and bucket).
  - Processes cities sequentially; within each city, caching uses limited concurrency.
"""

import asyncio
import logging
from typing import Any

from backend import firestore_repo as repo
from backend.social_scraper import cache_media_for_posts


async def process_city(city: dict[str, Any]) -> dict[str, Any]:
    city_id = int(city["id"])  # firestore_repo returns int id
    posts = repo.list_city_posts(city_id)
    if not posts:
        return {"cityId": city_id, "city": city.get("city"), "processed": 0}

    cached = await cache_media_for_posts(city_id, posts)
    # Save back (preserve default cap=None to keep full set)
    repo.save_city_posts(city_id, cached, cap=None)
    return {
        "cityId": city_id,
        "city": city.get("city"),
        "processed": len(cached),
    }


async def main() -> None:
    logging.basicConfig(level=logging.INFO)
    cities = repo.list_cities()
    if not cities:
        print("No cities found.")
        return
    results = []
    for c in cities:
        try:
            res = await process_city(c)
            print(f"Backfilled city {res['city']} (id={res['cityId']}): {res['processed']} posts")
            results.append(res)
        except Exception as e:
            print(f"Error processing city {c.get('city')} (id={c.get('id')}): {type(e).__name__}: {e}")
    total = sum(r.get("processed", 0) for r in results)
    print(f"Done. Total posts processed: {total}")


if __name__ == "__main__":
    asyncio.run(main())



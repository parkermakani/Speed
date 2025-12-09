from __future__ import annotations

"""Backfill script: cache media for existing Supabase posts and rewrite URLs.

Usage:
  python -m backend.scripts.run_media_backfill

Notes:
  - Requires Supabase to be configured (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY).
  - Processes cities sequentially; within each city, caching uses limited concurrency.
  - Only processes posts that don't already have cached URLs (checks for supabase.co/storage in URL).
"""

import asyncio
import logging
import os
from typing import Any

from dotenv import load_dotenv

load_dotenv()

from backend import supabase_repo as repo
from backend.social_scraper import cache_media_for_posts


def _needs_caching(post: dict[str, Any]) -> bool:
    """Check if a post has uncached media URLs."""
    for key in ["mediaUrl", "imageUrl", "avatarUrl"]:
        url = post.get(key) or ""
        if url and "supabase.co/storage" not in url.lower() and "supabase.in/storage" not in url.lower():
            # Has a URL that's not cached
            return True
    return False


async def process_city(city: dict[str, Any]) -> dict[str, Any]:
    city_id = int(city["id"])
    city_name = city.get("city", "Unknown")

    posts = repo.list_city_posts(city_id)
    if not posts:
        return {"cityId": city_id, "city": city_name, "processed": 0, "skipped": 0}

    # Filter to only posts that need caching
    posts_to_cache = [p for p in posts if _needs_caching(p)]
    skipped = len(posts) - len(posts_to_cache)

    if not posts_to_cache:
        return {"cityId": city_id, "city": city_name, "processed": 0, "skipped": skipped}

    print(f"  Processing {len(posts_to_cache)} posts (skipping {skipped} already cached)...")

    cached = await cache_media_for_posts(city_id, posts_to_cache)

    # Save back the cached posts
    if cached:
        repo.save_city_posts(city_id, cached)

    return {
        "cityId": city_id,
        "city": city_name,
        "processed": len(cached),
        "skipped": skipped,
    }


async def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")

    print("=" * 60)
    print("  Media Backfill Script (Supabase)")
    print("=" * 60)
    print(f"  Supabase URL: {os.getenv('SUPABASE_URL', 'NOT SET')[:50]}...")
    print()

    cities = repo.list_cities()
    if not cities:
        print("No cities found.")
        return

    print(f"Found {len(cities)} cities to process.")
    print()

    results = []
    for c in cities:
        city_name = c.get("city", "Unknown")
        city_id = c.get("id")
        print(f"Processing city: {city_name} (id={city_id})")
        try:
            res = await process_city(c)
            print(f"  Completed: {res['processed']} posts cached, {res['skipped']} skipped")
            results.append(res)
        except Exception as e:
            print(f"  Error: {type(e).__name__}: {e}")
        print()

    total_processed = sum(r.get("processed", 0) for r in results)
    total_skipped = sum(r.get("skipped", 0) for r in results)

    print("=" * 60)
    print(f"  Done! Total posts processed: {total_processed}")
    print(f"  Total posts skipped (already cached): {total_skipped}")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())

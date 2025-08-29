#!/usr/bin/env python3
# mypy: ignore-errors
from __future__ import annotations

import asyncio
import os
import sys
from pathlib import Path

from dotenv import load_dotenv


def _ensure_project_on_path() -> None:
    root = Path(__file__).resolve().parents[2]
    if str(root) not in sys.path:
        sys.path.append(str(root))


async def main() -> int:
    load_dotenv()
    _ensure_project_on_path()

    # Lazy imports after PATH/env prepared
    from backend import firestore_repo as repo
    from backend.social_scraper import scrape_curator_posts

    settings = repo.get_settings()
    # Basic check whether Curator is configured
    has_json = bool((settings.get("curatorJsonUrl") or "").strip())
    has_api = all(
        [
            (settings.get("curatorApiBase") or "").strip(),
            os.getenv("CURATOR_API_KEY") or (settings.get("curatorApiKey") or "").strip(),
            (settings.get("curatorFeedId") or "").strip(),
        ]
    )
    if not (has_json or has_api):
        print("Curator not configured. Set CURATOR_JSON_URL or CURATOR_API_BASE/API_KEY/FEED_ID.")
        return 1

    # Find current city
    cities = repo.list_cities()
    current = next((c for c in cities if c.get("isCurrent")), None)
    if not current:
        print("No current city found.")
        return 1

    posts = await scrape_curator_posts(current, settings)
    print(f"Fetched {len(posts)} curator posts for {current.get('city')}, saving to Firestore...")
    if posts:
        repo.save_city_posts(current["id"], posts)
    print("Done.")
    return 0


if __name__ == "__main__":
    try:
        code = asyncio.run(main())
    except KeyboardInterrupt:
        code = 130
    sys.exit(code)



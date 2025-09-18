"""Snapshot Firestore cities and post counts.

Prints a JSON array sorted by order with fields:
- id, city, state, lat, lng, order, isCurrent, lastCurrentAt, keywords,
- locatorIconUrl, locatorPng, postsCount

This script is read-only and will not modify any data.
"""

from __future__ import annotations

import json
import os
from typing import Any, Dict, List


def _ensure_firebase_env() -> None:
    # Default to bundled service account if FIREBASE_SERVICE_ACCOUNT_JSON not set
    if not os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON"):
        os.environ["FIREBASE_SERVICE_ACCOUNT_JSON"] = "backend/firebase-service-account.json"


def main() -> None:
    _ensure_firebase_env()
    # Lazy import after env set so firebase init picks it up
    from backend.firestore_repo import list_cities, list_city_posts  # type: ignore

    cities = list_cities()
    # Attach post counts for visibility; do not mutate Firestore
    snapshot: List[Dict[str, Any]] = []
    for c in cities:
        try:
            posts_count = len(list_city_posts(int(c["id"])))
        except Exception:
            posts_count = None  # type: ignore
        def _ser(v: Any):
            try:
                # Firestore Timestamp -> iso
                if hasattr(v, "isoformat"):
                    return v.isoformat()
            except Exception:
                pass
            return v

        snapshot.append(
            {
                "id": int(c["id"]),
                "city": c.get("city"),
                "state": c.get("state"),
                "lat": c.get("lat"),
                "lng": c.get("lng"),
                "order": c.get("order"),
                "isCurrent": c.get("isCurrent"),
                "lastCurrentAt": _ser(c.get("lastCurrentAt")),
                "keywords": c.get("keywords"),
                "locatorIconUrl": c.get("locatorIconUrl"),
                "locatorPng": c.get("locatorPng"),
                "postsCount": posts_count,
            }
        )

    # Stable sort by order then id
    snapshot.sort(key=lambda x: ((x.get("order") or 0), int(x.get("id") or 0)))

    print(json.dumps(snapshot, indent=2, sort_keys=False))


if __name__ == "__main__":
    main()



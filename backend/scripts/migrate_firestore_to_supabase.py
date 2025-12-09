#!/usr/bin/env python3
"""
One-time migration script: Firestore -> Supabase

Run with: python -m backend.scripts.migrate_firestore_to_supabase

Prerequisites:
- FIREBASE_SERVICE_ACCOUNT_JSON set (for reading from Firestore)
- SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY set (for writing to Supabase)
- SPEED_CLIENT_ID set (defaults to 'speed-does-america')
- SQL schema must be run in Supabase first
"""

import os
import sys
from datetime import datetime, timezone
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Initialize Firebase first
print("Initializing Firebase...")
from backend.firebase import init_firebase
init_firebase()

from firebase_admin import firestore

# Initialize Supabase
print("Initializing Supabase...")
from backend.supabase_client import get_supabase, get_client_id

# Get clients
fb_client = firestore.client()
supabase = get_supabase()
client_id = get_client_id()

print(f"Client ID: {client_id}")
print()


def _parse_timestamp(ts) -> str | None:
    """Parse various timestamp formats to ISO string."""
    if ts is None:
        return None
    if hasattr(ts, "isoformat"):
        return ts.isoformat()
    if isinstance(ts, str):
        return ts
    return None


def migrate_status():
    """Migrate status/current document."""
    print("=" * 50)
    print("Migrating status...")
    print("=" * 50)

    doc = fb_client.collection("status").document("current").get()

    if not doc.exists:
        print("  No status document found in Firestore")
        return

    data = doc.to_dict()
    print(f"  Found status: lat={data.get('lat')}, lng={data.get('lng')}, city={data.get('city')}")

    record = {
        "clientId": client_id,
        "lat": data.get("lat", 0),
        "lng": data.get("lng", 0),
        "state": data.get("state"),
        "quote": data.get("quote", ""),
        "city": data.get("city"),
        "cityPolygon": data.get("cityPolygon") or data.get("city_polygon"),
        "isSleep": data.get("isSleep", False),
        "isTraveling": data.get("isTraveling", False),
        "lastUpdated": _parse_timestamp(data.get("lastUpdated")) or datetime.now(timezone.utc).isoformat(),
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "updatedAt": datetime.now(timezone.utc).isoformat(),
    }

    supabase.table("speed_status").upsert(record, on_conflict="clientId").execute()
    print("  Status migrated successfully")
    print()


def migrate_cities():
    """Migrate cities collection."""
    print("=" * 50)
    print("Migrating cities...")
    print("=" * 50)

    cities_ref = fb_client.collection("cities")
    docs = list(cities_ref.stream())

    print(f"  Found {len(docs)} cities in Firestore")

    for doc in docs:
        data = doc.to_dict()

        record = {
            "id": doc.id,
            "clientId": client_id,
            "city": data.get("city", ""),
            "state": data.get("state", ""),
            "lat": data.get("lat", 0),
            "lng": data.get("lng", 0),
            "order": data.get("order", 0),
            "isCurrent": data.get("isCurrent", False),
            "lastCurrentAt": _parse_timestamp(data.get("lastCurrentAt")),
            "keywords": data.get("keywords"),
            "locatorIconUrl": data.get("locatorIconUrl"),
            "locatorPng": data.get("locatorPng"),
            "createdAt": datetime.now(timezone.utc).isoformat(),
            "updatedAt": datetime.now(timezone.utc).isoformat(),
        }

        supabase.table("speed_cities").upsert(record, on_conflict="id").execute()
        print(f"    Migrated city: {data.get('city')}, {data.get('state')} (id={doc.id})")

    print(f"  Cities migrated successfully")
    print()


def migrate_posts():
    """Migrate posts subcollections from all cities."""
    print("=" * 50)
    print("Migrating posts...")
    print("=" * 50)

    cities_ref = fb_client.collection("cities")
    docs = list(cities_ref.stream())

    total_posts = 0

    for city_doc in docs:
        city_id = city_doc.id
        posts_ref = cities_ref.document(city_id).collection("posts")
        posts = list(posts_ref.stream())

        if not posts:
            continue

        print(f"  City {city_id}: {len(posts)} posts")

        records = []
        for post_doc in posts:
            p = post_doc.to_dict()
            records.append(
                {
                    "clientId": client_id,
                    "cityId": city_id,
                    "platform": p.get("platform"),
                    "postId": p.get("id") or p.get("postId"),
                    "username": p.get("username"),
                    "caption": p.get("caption"),
                    "mediaUrl": p.get("mediaUrl"),
                    "imageUrl": p.get("imageUrl"),
                    "avatarUrl": p.get("avatarUrl"),
                    "likeCount": p.get("likeCount") or p.get("likes") or 0,
                    "timestamp": _parse_timestamp(p.get("timestamp")),
                    "timestampDt": _parse_timestamp(p.get("timestampDt") or p.get("timestamp")),
                    "url": p.get("url"),
                    "createdAt": datetime.now(timezone.utc).isoformat(),
                    "updatedAt": datetime.now(timezone.utc).isoformat(),
                }
            )

        # Batch insert (Supabase handles large inserts)
        if records:
            supabase.table("speed_posts").insert(records).execute()
            total_posts += len(records)

    print(f"  Total posts migrated: {total_posts}")
    print()


def migrate_merch():
    """Migrate merch collection."""
    print("=" * 50)
    print("Migrating merch...")
    print("=" * 50)

    merch_ref = fb_client.collection("merch")
    docs = list(merch_ref.stream())

    print(f"  Found {len(docs)} merch items in Firestore")

    for doc in docs:
        data = doc.to_dict()

        record = {
            "id": doc.id,
            "clientId": client_id,
            "name": data.get("name", ""),
            "price": data.get("price", ""),
            "imageUrl": data.get("imageUrl", ""),
            "url": data.get("url"),
            "active": data.get("active", True),
            "shirtTexture": data.get("shirtTexture"),
            "defaultAnimation": data.get("defaultAnimation"),
            "autoDisableAt": _parse_timestamp(data.get("autoDisableAt")),
            "shopifyVariantId": data.get("shopifyVariantId"),
            "shopifyProductId": data.get("shopifyProductId"),
            "createdAt": datetime.now(timezone.utc).isoformat(),
            "updatedAt": datetime.now(timezone.utc).isoformat(),
        }

        supabase.table("speed_merch").upsert(record, on_conflict="id").execute()
        print(f"    Migrated merch: {data.get('name')} (id={doc.id})")

    print("  Merch migrated successfully")
    print()


def migrate_settings():
    """Migrate settings/globals document."""
    print("=" * 50)
    print("Migrating settings...")
    print("=" * 50)

    doc = fb_client.collection("settings").document("globals").get()

    if not doc.exists:
        print("  No settings document found, using defaults")
        data = {}
    else:
        data = doc.to_dict()
        print(f"  Found settings with {len(data)} keys")

    record = {
        "id": "globals",
        "clientId": client_id,
        "socialScrapeIntervalMin": data.get("socialScrapeIntervalMin", 5),
        "instagramUsername": data.get("instagramUsername", ""),
        "twitterUsername": data.get("twitterUsername", ""),
        "tiktokUsername": data.get("tiktokUsername", ""),
        "twitchUsername": data.get("twitchUsername", ""),
        "youtubeUsername": data.get("youtubeUsername", ""),
        "socialHashtag": data.get("socialHashtag", "SpeedDoesAmerica"),
        "curatorApiBase": data.get("curatorApiBase", ""),
        "curatorFeedId": data.get("curatorFeedId", ""),
        "curatorJsonUrl": data.get("curatorJsonUrl", ""),
        "disableMerch": data.get("disableMerch", False),
        "sleepHideUserBar": data.get("sleepHideUserBar", False),
        "departureTime": data.get("departureTime", "22:00"),
        "departureTimeUtc": data.get("departureTimeUtc", 1320),
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "updatedAt": datetime.now(timezone.utc).isoformat(),
    }

    supabase.table("speed_settings").upsert(record, on_conflict="clientId").execute()
    print("  Settings migrated successfully")
    print()


def main():
    print()
    print("=" * 60)
    print("  Firestore to Supabase Migration")
    print("=" * 60)
    print(f"  Client ID: {client_id}")
    print(f"  Supabase URL: {os.getenv('SUPABASE_URL', 'NOT SET')[:50]}...")
    print()

    # Verify we can connect
    try:
        # Test Supabase connection
        result = supabase.table("clients").select("id").eq("id", client_id).execute()
        if not result.data:
            print(f"WARNING: Client '{client_id}' not found in clients table.")
            print("Make sure to run the SQL schema first, including:")
            print(f"  INSERT INTO clients (id, name, slug, \"isActive\", \"createdAt\", \"updatedAt\")")
            print(f"  VALUES ('{client_id}', 'Speed Does America', 'speed', true, NOW(), NOW());")
            print()
            response = input("Continue anyway? (y/N): ")
            if response.lower() != "y":
                print("Aborting.")
                return
    except Exception as e:
        print(f"ERROR: Cannot connect to Supabase: {e}")
        return

    migrate_status()
    migrate_cities()
    migrate_posts()
    migrate_merch()
    migrate_settings()

    print()
    print("=" * 60)
    print("  Migration complete!")
    print("=" * 60)
    print()
    print("Next steps:")
    print("1. Verify data in Supabase dashboard")
    print("2. Create admin user in Supabase Auth (same email/password as Firebase)")
    print("3. Update .env files with Supabase credentials")
    print("4. Test locally before deploying")
    print()


if __name__ == "__main__":
    main()

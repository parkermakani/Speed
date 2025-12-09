#!/usr/bin/env python3
"""
Migrate media files from Firebase Storage to Supabase Storage.

This script:
1. Finds all posts with Firebase Storage URLs
2. Downloads each file via HTTP
3. Uploads to Supabase Storage with the same path
4. Updates post records in Supabase to point to new URLs

Usage:
  python -m backend.scripts.migrate_storage

Prerequisites:
- SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY set
"""

import os
import re
import httpx
import asyncio
from urllib.parse import urlparse, unquote
from dotenv import load_dotenv

load_dotenv()

print("Initializing Supabase...")
from backend.supabase_client import get_storage, get_storage_bucket, get_supabase, get_client_id

supabase_storage = get_storage()
supabase_bucket = get_storage_bucket()
supabase_db = get_supabase()
client_id = get_client_id()

print(f"Supabase bucket: {supabase_bucket}")
print(f"Client ID: {client_id}")
print()


def get_supabase_public_url(path: str) -> str:
    """Construct Supabase Storage public URL."""
    base_url = os.getenv("SUPABASE_URL").rstrip("/")
    return f"{base_url}/storage/v1/object/public/{supabase_bucket}/{path}"


def is_firebase_url(url: str) -> bool:
    """Check if URL is a Firebase Storage URL."""
    if not url:
        return False
    url_lower = url.lower()
    return (
        "firebasestorage.googleapis.com" in url_lower or
        "firebasestorage.app" in url_lower or
        ("storage.googleapis.com" in url_lower and "firebasestorage" in url_lower)
    )


def extract_path_from_firebase_url(url: str) -> str | None:
    """Extract the storage path from a Firebase URL."""
    # URL formats:
    # https://storage.googleapis.com/sdasite-a35a5.firebasestorage.app/cities/1/posts/xxx/media.jpg
    # https://firebasestorage.googleapis.com/v0/b/bucket/o/path%2Fto%2Ffile?...

    if "storage.googleapis.com" in url and "firebasestorage.app" in url:
        # Format: https://storage.googleapis.com/bucket-name.firebasestorage.app/path/to/file
        match = re.search(r'firebasestorage\.app/(.+?)(?:\?|$)', url)
        if match:
            return unquote(match.group(1))

    if "firebasestorage.googleapis.com" in url:
        # Format: https://firebasestorage.googleapis.com/v0/b/bucket/o/path%2Fto%2Ffile?...
        match = re.search(r'/o/(.+?)(?:\?|$)', url)
        if match:
            return unquote(match.group(1))

    return None


async def download_and_upload(url: str, path: str, client: httpx.AsyncClient) -> str | None:
    """Download from Firebase URL and upload to Supabase. Returns new URL or None."""
    try:
        # Download
        resp = await client.get(url, follow_redirects=True, timeout=60.0)
        if resp.status_code != 200:
            print(f"    Failed to download (HTTP {resp.status_code})")
            return None

        data = resp.content
        content_type = resp.headers.get("content-type", "application/octet-stream")

        # Upload to Supabase
        try:
            supabase_storage.from_(supabase_bucket).upload(
                path,
                data,
                {"content-type": content_type, "upsert": "true"}
            )
        except Exception as e:
            err_str = str(e).lower()
            if "duplicate" in err_str or "already exists" in err_str:
                pass  # Already exists, that's fine
            else:
                print(f"    Upload error: {e}")
                return None

        return get_supabase_public_url(path)
    except Exception as e:
        print(f"    Error: {e}")
        return None


async def process_posts():
    """Find all posts with Firebase URLs and migrate them."""
    print("Fetching posts with Firebase Storage URLs...")

    # Fetch all posts
    result = supabase_db.from_("speed_posts").select("id, mediaUrl, imageUrl, avatarUrl").eq("clientId", client_id).execute()

    if not result or not hasattr(result, 'data') or not result.data:
        print("No posts found")
        return

    posts = result.data
    print(f"Found {len(posts)} total posts")

    # Filter to posts with Firebase URLs
    posts_to_migrate = []
    for post in posts:
        has_firebase = False
        for field in ["mediaUrl", "imageUrl", "avatarUrl"]:
            if is_firebase_url(post.get(field)):
                has_firebase = True
                break
        if has_firebase:
            posts_to_migrate.append(post)

    print(f"Found {len(posts_to_migrate)} posts with Firebase URLs to migrate")
    print()

    if not posts_to_migrate:
        return

    async with httpx.AsyncClient() as client:
        migrated = 0
        errors = 0

        for i, post in enumerate(posts_to_migrate):
            print(f"[{i+1}/{len(posts_to_migrate)}] Processing post {post['id'][:8]}...")
            updates = {}

            for field in ["mediaUrl", "imageUrl", "avatarUrl"]:
                url = post.get(field)
                if not is_firebase_url(url):
                    continue

                path = extract_path_from_firebase_url(url)
                if not path:
                    print(f"    Could not extract path from {field}")
                    continue

                print(f"    Migrating {field}: {path[:50]}...")
                new_url = await download_and_upload(url, path, client)
                if new_url:
                    updates[field] = new_url
                    print(f"    Success!")
                else:
                    errors += 1

            if updates:
                try:
                    supabase_db.from_("speed_posts").update(updates).eq("id", post["id"]).execute()
                    migrated += 1
                except Exception as e:
                    print(f"    DB update error: {e}")
                    errors += 1

    print()
    print(f"Migration complete: {migrated} posts updated, {errors} errors")


def main():
    print("=" * 60)
    print("  Firebase Storage → Supabase Storage Migration")
    print("=" * 60)
    print()

    asyncio.run(process_posts())

    print()
    print("=" * 60)
    print("  Done!")
    print("=" * 60)


if __name__ == "__main__":
    main()

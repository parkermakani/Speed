#!/usr/bin/env python3
"""
Migrate media files from Firebase Storage to Supabase Storage.

This script:
1. Lists all files in Firebase Storage bucket
2. Downloads each file
3. Uploads to Supabase Storage with the same path
4. Updates post records in Supabase to point to new URLs

Usage:
  python -m backend.scripts.migrate_storage

Prerequisites:
- FIREBASE_SERVICE_ACCOUNT_JSON set
- SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY set
"""

import os
import re
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

print("Initializing Firebase...")
from backend.firebase import init_firebase
init_firebase()

from firebase_admin import storage as fb_storage

print("Initializing Supabase...")
from backend.supabase_client import get_storage, get_storage_bucket, get_supabase, get_client_id

# Get clients
firebase_bucket = fb_storage.bucket()
supabase_storage = get_storage()
supabase_bucket = get_storage_bucket()
supabase_db = get_supabase()
client_id = get_client_id()

print(f"Firebase bucket: {firebase_bucket.name}")
print(f"Supabase bucket: {supabase_bucket}")
print(f"Client ID: {client_id}")
print()


def get_supabase_public_url(path: str) -> str:
    """Construct Supabase Storage public URL."""
    base_url = os.getenv("SUPABASE_URL").rstrip("/")
    return f"{base_url}/storage/v1/object/public/{supabase_bucket}/{path}"


def migrate_file(blob) -> tuple[str, str] | None:
    """Download from Firebase and upload to Supabase. Returns (old_url, new_url) or None."""
    path = blob.name

    # Skip if not a media file
    if not any(path.lower().endswith(ext) for ext in ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.mp4']):
        return None

    try:
        # Download from Firebase
        data = blob.download_as_bytes()

        # Determine content type
        content_type = blob.content_type or "application/octet-stream"

        # Upload to Supabase
        try:
            supabase_storage.from_(supabase_bucket).upload(
                path,
                data,
                {"content-type": content_type, "upsert": "true"}
            )
        except Exception as e:
            # Check if already exists
            if "duplicate" in str(e).lower() or "already exists" in str(e).lower():
                print(f"  Already exists: {path}")
            else:
                raise

        # Get URLs
        old_url = blob.public_url
        new_url = get_supabase_public_url(path)

        return (old_url, new_url)
    except Exception as e:
        print(f"  Error migrating {path}: {e}")
        return None


def update_post_urls(url_mapping: dict[str, str]):
    """Update post records to use new Supabase URLs."""
    if not url_mapping:
        return

    print(f"\nUpdating {len(url_mapping)} URLs in post records...")

    # Fetch all posts
    result = supabase_db.from_("speed_posts").select("id, mediaUrl, imageUrl, avatarUrl").eq("clientId", client_id).execute()

    if not result or not hasattr(result, 'data') or not result.data:
        print("  No posts found")
        return

    updated = 0
    for post in result.data:
        updates = {}

        for field in ["mediaUrl", "imageUrl", "avatarUrl"]:
            old_url = post.get(field)
            if old_url:
                # Check if this URL needs updating
                for firebase_url, supabase_url in url_mapping.items():
                    # Match by path since full URLs might differ
                    if firebase_url in old_url or any(part in old_url for part in firebase_url.split("/")[-2:]):
                        updates[field] = supabase_url
                        break
                    # Also check for firebasestorage URLs
                    if "firebasestorage.googleapis.com" in old_url:
                        # Extract path and check
                        path_match = re.search(r'/o/(.+?)\?', old_url)
                        if path_match:
                            firebase_path = path_match.group(1).replace('%2F', '/')
                            if firebase_path in url_mapping:
                                updates[field] = url_mapping[firebase_path]
                                break

        if updates:
            try:
                supabase_db.from_("speed_posts").update(updates).eq("id", post["id"]).execute()
                updated += 1
            except Exception as e:
                print(f"  Error updating post {post['id']}: {e}")

    print(f"  Updated {updated} posts")


def main():
    print("=" * 60)
    print("  Firebase Storage → Supabase Storage Migration")
    print("=" * 60)
    print()

    # List all blobs in Firebase
    print("Listing files in Firebase Storage...")
    blobs = list(firebase_bucket.list_blobs())
    print(f"Found {len(blobs)} files")
    print()

    # Filter to only media files
    media_blobs = [b for b in blobs if any(b.name.lower().endswith(ext) for ext in ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.mp4'])]
    print(f"Found {len(media_blobs)} media files to migrate")
    print()

    if not media_blobs:
        print("No media files found. Done.")
        return

    # Migrate files
    url_mapping = {}  # path -> new_url
    migrated = 0
    errors = 0

    for i, blob in enumerate(media_blobs):
        print(f"[{i+1}/{len(media_blobs)}] Migrating: {blob.name}")
        result = migrate_file(blob)
        if result:
            old_url, new_url = result
            url_mapping[blob.name] = new_url
            migrated += 1
        else:
            errors += 1

    print()
    print(f"Migration complete: {migrated} files migrated, {errors} errors")

    # Update post URLs
    update_post_urls(url_mapping)

    print()
    print("=" * 60)
    print("  Done!")
    print("=" * 60)


if __name__ == "__main__":
    main()

"""Supabase client initialization using postgrest and storage3 directly.

This avoids the gotrue/auth client dependency issues with the full supabase package.
"""

from __future__ import annotations

import os
from functools import lru_cache

from dotenv import load_dotenv
from postgrest import SyncPostgrestClient
from storage3 import SyncStorageClient

load_dotenv()

_postgrest: SyncPostgrestClient | None = None
_storage: SyncStorageClient | None = None


def get_supabase_url() -> str:
    """Return the Supabase project URL."""
    url = os.getenv("SUPABASE_URL")
    if not url:
        raise RuntimeError("SUPABASE_URL must be set")
    return url.rstrip("/")


def get_service_key() -> str:
    """Return the Supabase service role key."""
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not key:
        raise RuntimeError("SUPABASE_SERVICE_ROLE_KEY must be set")
    return key


def get_postgrest() -> SyncPostgrestClient:
    """Return singleton PostgREST client for database operations."""
    global _postgrest
    if _postgrest is None:
        url = get_supabase_url()
        key = get_service_key()
        rest_url = f"{url}/rest/v1"
        _postgrest = SyncPostgrestClient(
            rest_url,
            headers={
                "apikey": key,
                "Authorization": f"Bearer {key}",
            },
        )
    return _postgrest


def get_storage() -> SyncStorageClient:
    """Return singleton Storage client for file operations."""
    global _storage
    if _storage is None:
        url = get_supabase_url()
        key = get_service_key()
        storage_url = f"{url}/storage/v1"
        _storage = SyncStorageClient(
            storage_url,
            headers={
                "apikey": key,
                "Authorization": f"Bearer {key}",
            },
        )
    return _storage


# Compatibility alias - returns postgrest client which has .table() method
def get_supabase() -> SyncPostgrestClient:
    """Return the database client (postgrest). Alias for compatibility."""
    return get_postgrest()


def get_client_id() -> str:
    """Return the client ID for multi-tenant isolation."""
    return os.getenv("SPEED_CLIENT_ID", "speed-does-america")


def get_storage_bucket() -> str:
    """Return the Supabase storage bucket name."""
    return os.getenv("SUPABASE_STORAGE_BUCKET", "speed-media")

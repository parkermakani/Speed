"""Supabase client initialization and utilities."""

from __future__ import annotations

import os
from functools import lru_cache

from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

_client: Client | None = None


def get_supabase() -> Client:
    """Return singleton Supabase client using service role key."""
    global _client
    if _client is None:
        url = os.getenv("SUPABASE_URL")
        key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        if not url or not key:
            raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set")
        _client = create_client(url, key)
    return _client


def get_client_id() -> str:
    """Return the client ID for multi-tenant isolation."""
    return os.getenv("SPEED_CLIENT_ID", "speed-does-america")


def get_storage_bucket() -> str:
    """Return the Supabase storage bucket name."""
    return os.getenv("SUPABASE_STORAGE_BUCKET", "speed-media")

#!/usr/bin/env python3
"""One-time migration: copy data from local SQLite speed.db into Firestore.

Usage:
    python scripts/migrate_speeddb_to_firestore.py [--dry-run]

Requires:
    • Service account creds configured via FIREBASE_SERVICE_ACCOUNT_JSON env
    • firebase-admin installed (already in backend requirements)

Collections created:
    status/current          – single doc representing current Status
    cities/<id>             – docs for each City row
"""
# mypy: ignore-errors
from __future__ import annotations

import argparse
import datetime as dt
import os
import sqlite3
import sys
from pathlib import Path
from typing import Any

# Ensure project root on PYTHONPATH so `backend` is importable when script run directly
ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.append(str(ROOT))

from firebase_admin import firestore  # type: ignore

# Initialise Firebase Admin (re-uses singleton across imports)
from backend.firebase import init_firebase  # noqa: E402

init_firebase()

# Paths
ROOT = Path(__file__).resolve().parent.parent
DB_PATH = ROOT / "speed.db"


def fetch_sqlite_rows() -> tuple[dict[str, Any] | None, list[dict[str, Any]]]:
    if not DB_PATH.exists():
        raise FileNotFoundError(f"SQLite DB not found at {DB_PATH}")

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    cur.execute("SELECT * FROM status LIMIT 1")
    status_row = cur.fetchone()
    status: dict[str, Any] | None = dict(status_row) if status_row else None

    cur.execute("SELECT * FROM city")
    cities_rows = [dict(r) for r in cur.fetchall()]

    conn.close()
    return status, cities_rows


def iso(dt_val: Any) -> str | None:
    if dt_val is None:
        return None
    if isinstance(dt_val, str):
        return dt_val
    if isinstance(dt_val, (int, float)):
        return dt.datetime.utcfromtimestamp(dt_val).isoformat()
    if isinstance(dt_val, dt.datetime):
        return dt_val.isoformat()
    return str(dt_val)


def migrate(dry_run: bool = False) -> None:
    status, cities = fetch_sqlite_rows()
    client = firestore.client()

    # --- Migrate status ---
    if status:
        doc = {
            "lat": status["lat"],
            "lng": status["lng"],
            "state": status["state"],
            "quote": status["quote"],
            "city": status.get("city"),
            "cityPolygon": status.get("city_polygon"),
            "isSleep": bool(status.get("is_sleep")),
            "lastUpdated": iso(status.get("last_updated")),
        }
        print("Status document:", doc)
        if not dry_run:
            client.collection("status").document("current").set(doc)

    # --- Migrate cities ---
    for row in cities:
        city_doc = {
            "city": row["city"],
            "state": row["state"],
            "lat": row["lat"],
            "lng": row["lng"],
            "order": row["order"],
            "isCurrent": bool(row["is_current"]),
        }
        print(f"City {row['id']}: {city_doc}")
        if not dry_run:
            client.collection("cities").document(str(row["id"])).set(city_doc)

    print("Migration complete." if not dry_run else "Dry-run complete; no data written.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Migrate speed.db to Firestore")
    parser.add_argument("--dry-run", action="store_true", help="Print docs without writing")
    args = parser.parse_args()
    migrate(dry_run=args.dry_run)

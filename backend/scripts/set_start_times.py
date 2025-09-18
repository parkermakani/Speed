"""Set start times (lastCurrentAt) for cities after Austin to 05:00 UTC on their date.

Skips dates with multiple cities (e.g., Oklahoma City and Wichita on Sep 17).

Run:
  PYTHONPATH=. python3 -m backend.scripts.set_start_times
"""

from __future__ import annotations

from typing import Dict, Tuple

from datetime import datetime
try:
    from zoneinfo import ZoneInfo  # Python 3.9+
except Exception:  # pragma: no cover
    ZoneInfo = None  # type: ignore


# Map of (city,state) -> YYYY-MM-DD date string (UTC) where start time should be 05:00
CITY_DATES: Dict[Tuple[str, str], str] = {
    ("Denver", "Colorado"): "2025-09-18",
    ("Keystone", "South Dakota"): "2025-09-19",
    ("Jackson Hole", "Wyoming"): "2025-09-20",
    ("Salt Lake City", "Utah"): "2025-09-21",
    ("Boise", "Idaho"): "2025-09-22",
    ("Seattle", "Washington"): "2025-09-23",
    ("Portland", "Oregon"): "2025-09-24",
    ("San Francisco", "California"): "2025-09-25",
    ("Las Vegas", "Nevada"): "2025-09-26",
    ("Albuquerque", "New Mexico"): "2025-09-27",
    ("Phoenix", "Arizona"): "2025-09-28",
    ("Los Angeles", "California"): "2025-09-29",
}


def set_times() -> dict:
    from backend.firestore_repo import list_cities, update_city  # type: ignore

    cities = list_cities()
    by_key = {(c.get("city"), c.get("state")): c for c in cities}
    updates: dict[str, str] = {}
    for key, day in CITY_DATES.items():
        c = by_key.get(key)
        if not c:
            continue
        # Interpret 05:00 in America/Los_Angeles, convert to UTC ISO
        if ZoneInfo is not None:
            local = datetime.fromisoformat(day + "T05:00:00").replace(
                tzinfo=ZoneInfo("America/Los_Angeles")
            )
            utc = local.astimezone(ZoneInfo("UTC"))
            iso = utc.isoformat()
        else:
            # Fallback: assume PDT (UTC-7) for September dates
            iso = f"{day}T12:00:00+00:00"
        update_city(int(c["id"]), {"lastCurrentAt": iso})
        updates[f"{key[0]}, {key[1]}"] = iso
    return updates


def main() -> None:
    updated = set_times()
    print({"updated": updated})


if __name__ == "__main__":
    main()



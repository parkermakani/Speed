"""Propose and apply city updates to match the current tour schedule.

Safeguards:
- Only updates city fields: city, state, lat, lng, order, keywords, locatorIconUrl/locatorPng if provided
- DOES NOT modify isCurrent or lastCurrentAt
- DOES NOT touch posts subcollections

Usage:
  Dry run (default):
    PYTHONPATH=. python3 -m backend.scripts.update_cities_from_schedule

  Apply:
    APPLY=1 PYTHONPATH=. python3 -m backend.scripts.update_cities_from_schedule

Outputs a JSON summary of proposed/applied changes.
"""

from __future__ import annotations

import json
import os
from typing import Any, Dict, List, Optional, Tuple


def _ensure_env() -> None:
    if not os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON"):
        os.environ["FIREBASE_SERVICE_ACCOUNT_JSON"] = "backend/firebase-service-account.json"


# Target schedule order derived from the provided image (unique cities only)
# Keep Orlando in the early leg to preserve existing doc and posts.
SCHEDULE_ORDER: List[Tuple[str, str]] = [
    ("Miami", "Florida"),
    ("Orlando", "Florida"),
    ("Daytona", "Florida"),
    ("Jacksonville", "Florida"),
    ("Atlanta", "Georgia"),
    ("Greenville", "South Carolina"),
    ("Washington", "D.C."),
    ("Philadelphia", "Pennsylvania"),
    ("New York", "New York"),
    ("Boston", "Massachusetts"),
    ("Pittsburgh", "Pennsylvania"),
    ("Detroit", "Michigan"),
    ("Chicago", "Illinois"),
    ("Cincinnati", "Ohio"),
    ("Nashville", "Tennessee"),
    ("Memphis", "Tennessee"),
    ("Baton Rouge", "Louisiana"),
    ("New Orleans", "Louisiana"),
    ("Houston", "Texas"),
    ("Dallas", "Texas"),
    ("Austin", "Texas"),
    ("Kansas City", "Missouri"),  # keep existing city (9/16)
    ("Oklahoma City", "Oklahoma"),
    ("Wichita", "Kansas"),
    ("Denver", "Colorado"),
    ("Keystone", "South Dakota"),
    ("Jackson Hole", "Wyoming"),
    ("Salt Lake City", "Utah"),
    ("Boise", "Idaho"),
    ("Seattle", "Washington"),
    ("Portland", "Oregon"),
    ("San Francisco", "California"),
    # Lake Tahoe removed from route
    ("Las Vegas", "Nevada"),
    ("Albuquerque", "New Mexico"),
    ("Phoenix", "Arizona"),
    ("Los Angeles", "California"),
]


LATLNG: Dict[Tuple[str, str], Tuple[float, float]] = {
    ("Baton Rouge", "Louisiana"): (30.4515, -91.1871),
    ("Albuquerque", "New Mexico"): (35.0844, -106.6504),
    ("Oklahoma City", "Oklahoma"): (35.4676, -97.5164),
    ("Wichita", "Kansas"): (37.6872, -97.3301),
    ("Salt Lake City", "Utah"): (40.7608, -111.8910),
}


def normalise(name: str) -> str:
    return (name or "").strip().lower()


def build_plan(existing: List[Dict[str, Any]]) -> Dict[str, Any]:
    # Map existing by (city,state)
    key_to_id: Dict[Tuple[str, str], int] = {}
    for c in existing:
        city = (c.get("city") or "").strip()
        state = (c.get("state") or "").strip()
        if city:
            key_to_id[(city, state)] = int(c["id"])  # type: ignore

    planned: List[Dict[str, Any]] = []
    next_id = max([int(c["id"]) for c in existing] + [34]) + 1

    for idx, (city, state) in enumerate(SCHEDULE_ORDER, start=1):
        cid = key_to_id.get((city, state))
        if cid is None:
            # Prefer to reuse id 17 for Baton Rouge if it exists but is empty
            if (city, state) == ("Baton Rouge", "Louisiana"):
                # find id 17 if present
                for c in existing:
                    if int(c["id"]) == 17:
                        cid = 17
                        break
            # Assign new id (for Albuquerque)
            if cid is None:
                cid = next_id
                next_id += 1
        latlng = LATLNG.get((city, state))
        planned.append(
            {
                "id": cid,
                "city": city,
                "state": state,
                "order": idx,
                **({"lat": latlng[0], "lng": latlng[1]} if latlng else {}),
            }
        )

    return {"planned": planned}


def diff(existing: List[Dict[str, Any]], planned: List[Dict[str, Any]]):
    by_id = {int(c["id"]): c for c in existing}
    changes: List[Dict[str, Any]] = []
    for p in planned:
        eid = int(p["id"])
        cur = by_id.get(eid, {})
        delta: Dict[str, Any] = {"id": eid}
        for k in ("city", "state", "order", "lat", "lng"):
            pv = p.get(k)
            if pv is None:
                continue
            cv = cur.get(k)
            if k in ("lat", "lng") and (cv is None or abs(float(cv) - float(pv)) > 1e-6):
                delta[k] = pv
            elif k not in ("lat", "lng") and pv != cv:
                delta[k] = pv
        if len(delta) > 1:
            changes.append(delta)
    return changes


def apply_changes(changes: List[Dict[str, Any]]) -> None:
    from backend.firestore_repo import update_city  # type: ignore
    for ch in changes:
        eid = int(ch.pop("id"))
        payload = {k: v for k, v in ch.items() if v is not None}
        # Safety: ensure we never pass isCurrent/lastCurrentAt
        for forbidden in ("isCurrent", "lastCurrentAt", "last_current_at"):
            payload.pop(forbidden, None)
        update_city(eid, payload)


HIDE_CITIES: List[Tuple[str, str]] = [
    ("Lake Tahoe", "California"),
    ("Medford", "Oregon"),
]


def main() -> None:
    _ensure_env()
    from backend.firestore_repo import list_cities, update_city  # type: ignore

    existing = list_cities()
    plan = build_plan(existing)
    changes = diff(existing, plan["planned"])  # type: ignore

    result = {
        "countExisting": len(existing),
        "countPlanned": len(plan["planned"]),
        "changes": changes,
    }

    if os.getenv("APPLY") == "1":
        apply_changes(changes)
        # Optionally hide cities not on the schedule (e.g., Lake Tahoe)
        for city, state in HIDE_CITIES:
            for c in existing:
                if (c.get("city"), c.get("state")) == (city, state):
                    update_city(int(c["id"]), {"lat": 0.0, "lng": 0.0})
        result["applied"] = True
    else:
        result["applied"] = False

    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()



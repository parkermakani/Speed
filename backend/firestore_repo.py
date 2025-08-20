"""Firestore repository functions for Status and Cities collections."""
from __future__ import annotations

from datetime import datetime
from typing import Any, List, Optional

from firebase_admin import firestore  # type: ignore

from backend.firebase import init_firebase

init_firebase()
_client = firestore.client()

STATUS_COLL = _client.collection("status").document("current")
CITIES_COLL = _client.collection("cities")
MERCH_COLL = _client.collection("merch")


# ------------------ Status ------------------

def get_status() -> Optional[dict[str, Any]]:
    doc = STATUS_COLL.get()
    return doc.to_dict() if doc.exists else None


def update_status(payload: dict[str, Any]) -> dict[str, Any]:
    payload["lastUpdated"] = datetime.utcnow().isoformat()
    STATUS_COLL.set(payload, merge=True)
    return get_status()  # type: ignore


# ------------------ Cities ------------------

def list_cities() -> List[dict[str, Any]]:
    docs = [doc.to_dict() | {"id": int(doc.id)} for doc in CITIES_COLL.stream()]
    # Ensure sort by 'order', default 0 when missing
    docs.sort(key=lambda d: (d.get("order") or 0))
    return docs


def update_city(city_id: int, data: dict[str, Any]) -> dict[str, Any]:
    doc_ref = CITIES_COLL.document(str(city_id))
    doc_ref.set(data, merge=True)
    doc = doc_ref.get()
    return doc.to_dict() | {"id": city_id}

# ------------------ Merch ------------------


def list_merch() -> list[dict[str, Any]]:
    return [doc.to_dict() | {"id": doc.id} for doc in MERCH_COLL.stream()]


def create_merch(data: dict[str, Any]) -> dict[str, Any]:
    doc_ref = MERCH_COLL.document()
    doc_ref.set(data)
    return data | {"id": doc_ref.id}


def update_merch(item_id: str, data: dict[str, Any]) -> dict[str, Any]:
    doc_ref = MERCH_COLL.document(item_id)
    doc_ref.set(data, merge=True)
    return doc_ref.get().to_dict() | {"id": item_id}

# ------------------ Sleep flag ------------------


def get_sleep_flag() -> bool:
    doc = get_status()
    return bool(doc.get("isSleep")) if doc else False


def set_sleep_flag(is_sleep: bool) -> bool:
    update_status({"isSleep": is_sleep})
    return is_sleep


# ------------------ Journey helper ------------------


def compute_journey() -> dict[str, Any]:
    all_cities = list_cities()

    def has_coords(c: dict[str, Any]) -> bool:
        lat = c.get("lat") or 0.0
        lng = c.get("lng") or 0.0
        return not (abs(lat) < 0.0001 and abs(lng) < 0.0001)

    cities = [c for c in all_cities if has_coords(c)]

    # Ensure order is an int even if missing
    for c in cities:
        if c.get("order") is None:
            c["order"] = 0

    cities.sort(key=lambda c: c["order"])

    current = next((c for c in cities if c.get("isCurrent")), (cities[0] if cities else None))

    if current and current.get("order") is not None:
        path = [c for c in cities if c["order"] < current["order"]]
    else:
        path = []

    return {
        "currentCity": current,
        "path": path,
    }

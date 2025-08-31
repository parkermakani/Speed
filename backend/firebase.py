"""Initialize Firebase Admin SDK and expose `firebase_app`."""

from __future__ import annotations

import logging
import os
from pathlib import Path

from firebase_admin import App as FirebaseApp, credentials, initialize_app
from firebase_admin import storage  # type: ignore

firebase_app: FirebaseApp | None = None


def init_firebase() -> FirebaseApp:
    """Initialise Firebase using service account creds or ADC.

    Returns the singleton FirebaseApp instance.
    """
    global firebase_app

    if firebase_app is not None:
        return firebase_app

    cred_path = os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON")
    if cred_path:
        cred_file = Path(cred_path)
        if not cred_file.is_absolute():
            # Resolve relative to project root (one level up from backend/)
            project_root = Path(__file__).resolve().parent.parent
            cred_file = project_root / cred_file
        if cred_file.exists():
            cred = credentials.Certificate(str(cred_file))
        else:
            logging.error("Firebase service account JSON not found at %s", cred_file)
            raise FileNotFoundError(f"Service account key not found: {cred_file}")
    else:
        logging.warning(
            "FIREBASE_SERVICE_ACCOUNT_JSON not set; using Application Default Credentials."
        )
        cred = credentials.ApplicationDefault()

    # Attach a default Storage bucket if we can resolve one
    try:
        bucket_name = get_storage_bucket_name()
    except Exception:
        bucket_name = None

    if bucket_name:
        firebase_app = initialize_app(cred, {"storageBucket": bucket_name})
        logging.info("Firebase Admin initialised with storage bucket: %s", bucket_name)
    else:
        firebase_app = initialize_app(cred)
        logging.info("Firebase Admin initialised (no storage bucket configured)")
    return firebase_app


# Initialise on import for convenience
init_firebase()


def get_storage_bucket_name() -> str | None:
    """Return the Firebase Storage bucket name from env or default app config.

    If FIREBASE_STORAGE_BUCKET is not set, firebase_admin.storage will use
    the default bucket bound to the Firebase app (if configured).
    """
    # Prefer explicit backend env var
    name = os.getenv("FIREBASE_STORAGE_BUCKET")
    if name:
        return name
    # Fallback to frontend-style env var if user set only Vite config
    name = os.getenv("VITE_FIREBASE_STORAGE_BUCKET")
    if name:
        return name
    # Last resort: infer from project id when available
    project_id = (
        os.getenv("GOOGLE_CLOUD_PROJECT")
        or os.getenv("GCLOUD_PROJECT")
        or os.getenv("FIREBASE_PROJECT_ID")
        or os.getenv("VITE_FIREBASE_PROJECT_ID")
    )
    if project_id:
        return f"{project_id}.appspot.com"
    return None


def get_bucket():
    """Return a Google Cloud Storage bucket for file uploads."""
    init_firebase()
    bucket_name = get_storage_bucket_name()
    if bucket_name:
        return storage.bucket(bucket_name)
    return storage.bucket()


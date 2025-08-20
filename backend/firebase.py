"""Initialize Firebase Admin SDK and expose `firebase_app`."""

from __future__ import annotations

import logging
import os
from pathlib import Path

from firebase_admin import App as FirebaseApp, credentials, initialize_app

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

    firebase_app = initialize_app(cred)
    logging.info("Firebase Admin initialised")
    return firebase_app


# Initialise on import for convenience
init_firebase()

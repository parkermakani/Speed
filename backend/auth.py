"""Authentication helpers – now using Firebase ID tokens instead of custom JWT."""

from __future__ import annotations

from typing import Optional

import os
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel

from firebase_admin import auth as firebase_auth

from backend.firebase import init_firebase

# Ensure Firebase Admin is initialised once.
init_firebase()

# Security scheme (expecting "Authorization: Bearer <id_token>")
security = HTTPBearer(auto_error=True)


class TokenData(BaseModel):
    uid: str
    email: Optional[str] = None


def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)) -> TokenData:
    """Verify Firebase ID token and return TokenData."""

    token = credentials.credentials
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        decoded = firebase_auth.verify_id_token(token)
    except Exception:
        # Any verification error should yield 401
        raise credentials_exception

    uid = decoded.get("uid")
    if not uid:
        raise credentials_exception

    return TokenData(uid=uid, email=decoded.get("email"))


# For now, treat any verified Firebase user as admin.
def get_current_admin(token_data: TokenData = Depends(verify_token)) -> TokenData:
    return token_data
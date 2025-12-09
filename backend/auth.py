"""Authentication helpers using Supabase JWT verification."""

from __future__ import annotations

import os
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel
import jwt

# Supabase JWT configuration
SUPABASE_JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET", "")

# Security scheme (expecting "Authorization: Bearer <access_token>")
security = HTTPBearer(auto_error=True)


class TokenData(BaseModel):
    uid: str
    email: Optional[str] = None
    role: Optional[str] = None


def verify_token(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> TokenData:
    """Verify Supabase JWT token and return TokenData."""

    token = credentials.credentials
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    if not SUPABASE_JWT_SECRET:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="SUPABASE_JWT_SECRET not configured",
        )

    try:
        decoded = jwt.decode(
            token,
            SUPABASE_JWT_SECRET,
            algorithms=["HS256"],
            audience="authenticated",
        )
    except jwt.ExpiredSignatureError:
        raise credentials_exception
    except jwt.InvalidTokenError:
        raise credentials_exception
    except Exception:
        raise credentials_exception

    uid = decoded.get("sub")
    if not uid:
        raise credentials_exception

    return TokenData(
        uid=uid,
        email=decoded.get("email"),
        role=decoded.get("role"),
    )


def get_current_admin(token_data: TokenData = Depends(verify_token)) -> TokenData:
    """Verify user is admin (for now, any authenticated user)."""
    # In future, check token_data.role or a database lookup for admin status
    return token_data

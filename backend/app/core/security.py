"""Demo authentication.

Two fixed accounts stand in for the real INCOIS / Coast Guard identity provider.
Passwords are hashed at import time with PBKDF2-SHA256; they are published demo
credentials, not secrets, and are documented as such in the README.
"""
from __future__ import annotations

import hashlib
import hmac
import os
from datetime import datetime, timedelta, timezone
from typing import Literal, Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from pydantic import BaseModel

from app.core.config import settings

Role = Literal["analyst", "field"]

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/token", auto_error=False)

_PBKDF2_ROUNDS = 120_000


def hash_password(password: str, salt: bytes | None = None) -> tuple[bytes, bytes]:
    salt = salt or os.urandom(16)
    return salt, hashlib.pbkdf2_hmac("sha256", password.encode(), salt, _PBKDF2_ROUNDS)


def verify_password(password: str, salt: bytes, digest: bytes) -> bool:
    return hmac.compare_digest(hash_password(password, salt)[1], digest)


class User(BaseModel):
    email: str
    name: str
    role: Role
    org: str
    initials: str
    team: Optional[str] = None


DEMO_USERS: dict[str, dict] = {
    "analyst@incois.demo": {
        "password": "demo123",
        "user": User(
            email="analyst@incois.demo",
            name="Ocean Analyst",
            role="analyst",
            org="INCOIS · demo account",
            initials="OA",
        ),
    },
    "field@coastguard.demo": {
        "password": "demo123",
        "user": User(
            email="field@coastguard.demo",
            name="Field Team Lead",
            role="field",
            org="Indian Coast Guard · demo account",
            initials="FT",
            team="Indian Coast Guard patrol",
        ),
    },
}

_HASHES = {email: hash_password(rec["password"]) for email, rec in DEMO_USERS.items()}


def authenticate(email: str, password: str) -> Optional[User]:
    key = email.strip().lower()
    rec = DEMO_USERS.get(key)
    if not rec:
        return None
    salt, digest = _HASHES[key]
    if not verify_password(password, salt, digest):
        return None
    return rec["user"]


def create_access_token(user: User) -> tuple[str, int]:
    expires_in = settings.jwt_expire_minutes * 60
    payload = {
        "sub": user.email,
        "role": user.role,
        "name": user.name,
        "exp": datetime.now(timezone.utc) + timedelta(seconds=expires_in),
    }
    token = jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)
    return token, expires_in


def decode_token(token: str) -> User:
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except JWTError as exc:  # pragma: no cover - exercised through the API
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired token") from exc
    rec = DEMO_USERS.get(payload.get("sub", ""))
    if not rec:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Unknown account")
    return rec["user"]


def current_user(token: Optional[str] = Depends(oauth2_scheme)) -> User:
    if not token:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authenticated")
    return decode_token(token)


def optional_user(token: Optional[str] = Depends(oauth2_scheme)) -> Optional[User]:
    """Read-only endpoints stay open so the docs page and the replay work without a login."""
    if not token:
        return None
    try:
        return decode_token(token)
    except HTTPException:
        return None

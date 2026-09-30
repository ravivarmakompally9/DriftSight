from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm

from app.api.schemas import LoginRequest, TokenResponse, UserOut
from app.core.security import DEMO_USERS, User, authenticate, create_access_token, current_user

router = APIRouter(prefix="/auth", tags=["auth"])


def _token_for(user: User) -> TokenResponse:
    token, expires = create_access_token(user)
    return TokenResponse(access_token=token, expires_in=expires, user=UserOut(**user.model_dump()))


@router.post("/login", response_model=TokenResponse, summary="Sign in and get a JWT")
def login(body: LoginRequest) -> TokenResponse:
    """Two demo accounts exist, both with the password `demo123`:

    * `analyst@incois.demo` — analyst, sees every mission
    * `field@coastguard.demo` — field team, sees only its own missions
    """
    user = authenticate(body.email, body.password)
    if not user:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Wrong email or password")
    return _token_for(user)


@router.post("/token", response_model=TokenResponse, include_in_schema=False)
def login_form(form: OAuth2PasswordRequestForm = Depends()) -> TokenResponse:
    """OAuth2 password flow, so the /docs Authorize button works."""
    user = authenticate(form.username, form.password)
    if not user:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Wrong email or password")
    return _token_for(user)


@router.get("/me", response_model=UserOut, summary="Who am I")
def me(user: User = Depends(current_user)) -> UserOut:
    return UserOut(**user.model_dump())


@router.get("/demo-accounts", summary="The demo accounts shown on the sign-in screen")
def demo_accounts() -> list[dict]:
    return [
        {"email": email, "password": rec["password"], "name": rec["user"].name,
         "role": rec["user"].role, "org": rec["user"].org, "initials": rec["user"].initials}
        for email, rec in DEMO_USERS.items()
    ]

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlmodel import Session, or_, select

from app.core.db import get_session
from app.core.dependencies import get_current_user
from app.core.security import (
    create_access_token,
    hash_password,
    hash_token,
    normalize_email,
    normalize_username,
    verify_password,
)
from app.models import AuthTokenTable, UserTable
from app.schemas.auth import AuthResponse, LoginRequest, RegisterRequest, UserResponse

router = APIRouter(prefix="/auth", tags=["auth"])


def serialize_user(user: UserTable) -> UserResponse:
    return UserResponse(id=user.id, email=user.email, username=user.username, isActive=user.is_active)


@router.post("/register", response_model=AuthResponse)
def register(data: RegisterRequest, session: Session = Depends(get_session)):
    email = normalize_email(data.email)
    username = normalize_username(data.username)
    if not email or not username:
        raise HTTPException(status_code=400, detail="Email and username are required")

    existing_user = session.exec(
        select(UserTable).where(or_(UserTable.email == email, UserTable.username == username))
    ).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Email or username is already in use")

    user = UserTable(email=email, username=username, password_hash=hash_password(data.password))
    session.add(user)
    session.commit()
    session.refresh(user)

    token, token_hash, expires_at = create_access_token()
    session.add(AuthTokenTable(user_id=user.id, token_hash=token_hash, expires_at=expires_at))
    session.commit()
    return AuthResponse(token=token, user=serialize_user(user))


@router.post("/login", response_model=AuthResponse)
def login(data: LoginRequest, session: Session = Depends(get_session)):
    identifier = data.identifier.strip()
    user = session.exec(
        select(UserTable).where(
            or_(UserTable.email == normalize_email(identifier), UserTable.username == identifier)
        )
    ).first()
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="User is inactive")

    token, token_hash, expires_at = create_access_token()
    session.add(AuthTokenTable(user_id=user.id, token_hash=token_hash, expires_at=expires_at))
    session.commit()
    return AuthResponse(token=token, user=serialize_user(user))


@router.post("/logout")
def logout(
    authorization: str | None = Header(default=None),
    session: Session = Depends(get_session),
    _user: UserTable = Depends(get_current_user),
):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authentication required")
    token_hash = hash_token(authorization.removeprefix("Bearer ").strip())
    auth_token = session.exec(select(AuthTokenTable).where(AuthTokenTable.token_hash == token_hash)).first()
    if auth_token and auth_token.revoked_at is None:
        auth_token.revoked_at = datetime.now(timezone.utc)
        session.add(auth_token)
        session.commit()
    return {"message": "Logged out successfully"}


@router.get("/me", response_model=UserResponse)
def me(user: UserTable = Depends(get_current_user)):
    return serialize_user(user)

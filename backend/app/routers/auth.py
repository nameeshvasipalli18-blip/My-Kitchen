from __future__ import annotations

import json
import smtplib

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlmodel import Session, or_, select

from app.core.db import get_session
from app.core.dependencies import get_current_user
from app.core.email import is_password_reset_email_configured, send_password_reset_email
from app.core.security import (
    create_access_token,
    create_password_reset_token,
    hash_password,
    hash_token,
    normalize_email,
    normalize_username,
    verify_password,
)
from app.models import AuthTokenTable, PasswordResetTokenTable, UserTable, utc_now
from app.schemas.auth import (
    AvoidedFoodsUpdateRequest,
    AuthResponse,
    ForgotPasswordRequest,
    LoginRequest,
    RegisterRequest,
    ResetPasswordRequest,
    UserResponse,
)

router = APIRouter(prefix="/auth", tags=["auth"])


def serialize_user(user: UserTable) -> UserResponse:
    try:
        avoided_foods = json.loads(user.avoided_foods)
    except (TypeError, json.JSONDecodeError):
        avoided_foods = []
    return UserResponse(id=user.id, email=user.email, username=user.username, isActive=user.is_active, avoidedFoods=avoided_foods)


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


@router.post("/forgot-password")
def forgot_password(data: ForgotPasswordRequest, session: Session = Depends(get_session)):
    if not is_password_reset_email_configured():
        raise HTTPException(status_code=503, detail="Password reset email is not configured")

    email = normalize_email(data.email)
    user = session.exec(select(UserTable).where(UserTable.email == email)).first()
    if user and user.is_active:
        for reset_token in session.exec(
            select(PasswordResetTokenTable).where(
                PasswordResetTokenTable.user_id == user.id,
                PasswordResetTokenTable.used_at.is_(None),
            )
        ):
            reset_token.used_at = utc_now()
            session.add(reset_token)

        token, token_hash, expires_at = create_password_reset_token()
        session.add(
            PasswordResetTokenTable(
                user_id=user.id,
                token_hash=token_hash,
                expires_at=expires_at,
            )
        )
        session.commit()
        try:
            send_password_reset_email(user.email, token)
        except (OSError, smtplib.SMTPException) as error:
            raise HTTPException(status_code=503, detail="Unable to send password reset email") from error

    return {"message": "If an account exists for that email, a password reset link has been sent."}


@router.post("/reset-password")
def reset_password(data: ResetPasswordRequest, session: Session = Depends(get_session)):
    reset_token = session.exec(
        select(PasswordResetTokenTable).where(PasswordResetTokenTable.token_hash == hash_token(data.token))
    ).first()
    now = datetime.now(timezone.utc)
    if (
        not reset_token
        or reset_token.used_at is not None
        or reset_token.expires_at.replace(tzinfo=timezone.utc) <= now
    ):
        raise HTTPException(status_code=400, detail="This password reset link is invalid or has expired")

    user = session.get(UserTable, reset_token.user_id)
    if not user or not user.is_active:
        raise HTTPException(status_code=400, detail="This password reset link is invalid or has expired")

    user.password_hash = hash_password(data.password)
    user.updated_at = utc_now()
    reset_token.used_at = utc_now()
    for auth_token in session.exec(
        select(AuthTokenTable).where(
            AuthTokenTable.user_id == user.id,
            AuthTokenTable.revoked_at.is_(None),
        )
    ):
        auth_token.revoked_at = utc_now()
        session.add(auth_token)
    session.add(user)
    session.add(reset_token)
    session.commit()
    return {"message": "Your password has been reset. Please log in."}


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
        auth_token.revoked_at = utc_now()
        session.add(auth_token)
        session.commit()
    return {"message": "Logged out successfully"}


@router.get("/me", response_model=UserResponse)
def me(user: UserTable = Depends(get_current_user)):
    return serialize_user(user)


@router.put("/me/avoided-foods", response_model=UserResponse)
def update_avoided_foods(
    data: AvoidedFoodsUpdateRequest,
    user: UserTable = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    foods = list(dict.fromkeys(food.strip().lower() for food in data.avoidedFoods if food.strip()))
    user.avoided_foods = json.dumps(foods)
    user.updated_at = utc_now()
    session.add(user)
    session.commit()
    session.refresh(user)
    return serialize_user(user)

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import Depends, Header, HTTPException
from sqlmodel import Session, select

from app.core.db import get_session
from app.core.security import hash_token
from app.models import AuthTokenTable, KitchenMembershipTable, UserTable


def _unauthorized() -> HTTPException:
    return HTTPException(status_code=401, detail="Authentication required")


def _ensure_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def get_current_user(
    authorization: str | None = Header(default=None),
    session: Session = Depends(get_session),
) -> UserTable:
    if not authorization or not authorization.startswith("Bearer "):
        raise _unauthorized()

    token = authorization.removeprefix("Bearer ").strip()
    if not token:
        raise _unauthorized()

    token_hash = hash_token(token)
    auth_token = session.exec(select(AuthTokenTable).where(AuthTokenTable.token_hash == token_hash)).first()
    if not auth_token or auth_token.revoked_at is not None or _ensure_utc(auth_token.expires_at) <= datetime.now(timezone.utc):
        raise _unauthorized()

    user = session.get(UserTable, auth_token.user_id)
    if not user or not user.is_active:
        raise _unauthorized()
    return user


def get_kitchen_membership_or_403(session: Session, kitchen_id: int, user_id: int) -> KitchenMembershipTable:
    membership = session.exec(
        select(KitchenMembershipTable).where(
            KitchenMembershipTable.kitchen_id == kitchen_id,
            KitchenMembershipTable.user_id == user_id,
        )
    ).first()
    if not membership:
        raise HTTPException(status_code=403, detail="Kitchen access denied")
    return membership


def require_membership_role(membership: KitchenMembershipTable, allowed_roles: set[str]) -> None:
    if membership.role not in allowed_roles:
        raise HTTPException(status_code=403, detail="Insufficient kitchen permissions")

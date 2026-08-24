from __future__ import annotations

from datetime import datetime, timezone
from typing import ClassVar

from sqlalchemy import Column, String, UniqueConstraint
from sqlmodel import Field, SQLModel


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class UserTable(SQLModel, table=True):
    __tablename__: ClassVar[str] = "users"

    id: int | None = Field(default=None, primary_key=True)
    email: str = Field(index=True, unique=True)
    username: str = Field(index=True, unique=True)
    password_hash: str
    is_active: bool = Field(default=True)
    avoided_foods: str = Field(default="[]", sa_column=Column(String, nullable=False, server_default="[]"))
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)


class AuthTokenTable(SQLModel, table=True):
    __tablename__: ClassVar[str] = "auth_tokens"

    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="users.id", index=True)
    token_hash: str = Field(index=True, unique=True)
    created_at: datetime = Field(default_factory=utc_now)
    expires_at: datetime
    revoked_at: datetime | None = Field(default=None)


class PasswordResetTokenTable(SQLModel, table=True):
    __tablename__: ClassVar[str] = "password_reset_tokens"

    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="users.id", index=True)
    token_hash: str = Field(index=True, unique=True)
    created_at: datetime = Field(default_factory=utc_now)
    expires_at: datetime
    used_at: datetime | None = Field(default=None)


class KitchenTable(SQLModel, table=True):
    __tablename__: ClassVar[str] = "kitchens"

    id: int | None = Field(default=None, primary_key=True)
    name: str
    created_by_user_id: int = Field(foreign_key="users.id", index=True)
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)


class KitchenMembershipTable(SQLModel, table=True):
    __tablename__: ClassVar[str] = "kitchen_memberships"
    __table_args__ = (UniqueConstraint("kitchen_id", "user_id", name="uq_kitchen_membership"),)

    id: int | None = Field(default=None, primary_key=True)
    kitchen_id: int = Field(foreign_key="kitchens.id", index=True)
    user_id: int = Field(foreign_key="users.id", index=True)
    role: str = Field(default="member")
    created_at: datetime = Field(default_factory=utc_now)


class BillTable(SQLModel, table=True):
    __tablename__: ClassVar[str] = "bills"

    id: int | None = Field(default=None, primary_key=True)
    kitchen_id: int = Field(foreign_key="kitchens.id", index=True)
    created_by_user_id: int = Field(foreign_key="users.id", index=True)
    date: str
    store: str
    default_payer_membership_id: int = Field(foreign_key="kitchen_memberships.id", index=True)
    default_split_type: str = Field(default="all")
    status: str = Field(default="open")
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)


class BillParticipantTable(SQLModel, table=True):
    __tablename__: ClassVar[str] = "bill_participants"
    __table_args__ = (UniqueConstraint("bill_id", "membership_id", name="uq_bill_participant"),)

    id: int | None = Field(default=None, primary_key=True)
    bill_id: int = Field(foreign_key="bills.id", index=True)
    membership_id: int = Field(foreign_key="kitchen_memberships.id", index=True)


class BillDefaultSplitParticipantTable(SQLModel, table=True):
    __tablename__: ClassVar[str] = "bill_default_split_participants"
    __table_args__ = (UniqueConstraint("bill_id", "membership_id", name="uq_bill_default_split_participant"),)

    id: int | None = Field(default=None, primary_key=True)
    bill_id: int = Field(foreign_key="bills.id", index=True)
    membership_id: int = Field(foreign_key="kitchen_memberships.id", index=True)


class BillItemTable(SQLModel, table=True):
    __tablename__: ClassVar[str] = "bill_items"

    id: int | None = Field(default=None, primary_key=True)
    bill_id: int = Field(foreign_key="bills.id", index=True)
    name: str
    price: float
    paid_by_membership_id: int = Field(foreign_key="kitchen_memberships.id", index=True)
    split_type: str
    created_at: datetime = Field(default_factory=utc_now)


class BillItemSplitTable(SQLModel, table=True):
    __tablename__: ClassVar[str] = "bill_item_splits"
    __table_args__ = (UniqueConstraint("item_id", "membership_id", name="uq_bill_item_split"),)

    id: int | None = Field(default=None, primary_key=True)
    item_id: int = Field(foreign_key="bill_items.id", index=True)
    membership_id: int = Field(foreign_key="kitchen_memberships.id", index=True)

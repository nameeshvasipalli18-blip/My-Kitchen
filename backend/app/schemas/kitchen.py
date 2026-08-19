from __future__ import annotations

from pydantic import BaseModel, Field


class KitchenCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=100)


class KitchenUpdateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=100)


class KitchenMembershipAddRequest(BaseModel):
    identifier: str = Field(min_length=1)
    role: str = Field(default="member")


class KitchenMemberResponse(BaseModel):
    membershipId: int
    userId: int
    email: str
    username: str
    role: str


class KitchenSummaryResponse(BaseModel):
    id: int
    name: str
    role: str
    memberCount: int


class KitchenDetailResponse(BaseModel):
    id: int
    name: str
    role: str
    members: list[KitchenMemberResponse]

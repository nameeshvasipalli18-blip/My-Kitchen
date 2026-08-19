from __future__ import annotations

from pydantic import BaseModel, Field


class RegisterRequest(BaseModel):
    email: str
    username: str
    password: str = Field(min_length=8)


class LoginRequest(BaseModel):
    identifier: str
    password: str


class UserResponse(BaseModel):
    id: int
    email: str
    username: str
    isActive: bool


class AuthResponse(BaseModel):
    token: str
    user: UserResponse

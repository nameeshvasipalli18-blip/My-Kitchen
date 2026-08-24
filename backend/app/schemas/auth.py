from __future__ import annotations

from pydantic import BaseModel, Field


class RegisterRequest(BaseModel):
    email: str
    username: str
    password: str = Field(min_length=8)


class LoginRequest(BaseModel):
    identifier: str
    password: str


class ForgotPasswordRequest(BaseModel):
    email: str


class ResetPasswordRequest(BaseModel):
    token: str = Field(min_length=1)
    password: str = Field(min_length=8)


class UserResponse(BaseModel):
    id: int
    email: str
    username: str
    isActive: bool
    avoidedFoods: list[str] = Field(default_factory=list)


class AvoidedFoodsUpdateRequest(BaseModel):
    avoidedFoods: list[str] = Field(default_factory=list)


class AuthResponse(BaseModel):
    token: str
    user: UserResponse

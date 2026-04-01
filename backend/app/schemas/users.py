from datetime import datetime

from pydantic import BaseModel, Field


class UserProfile(BaseModel):
    id: str
    email: str | None = None
    phone: str | None = None
    full_name: str | None = None
    avatar_url: str | None = None
    push_token: str | None = None
    is_merchant: bool = False
    created_at: datetime


class UserUpdate(BaseModel):
    full_name: str | None = None
    avatar_url: str | None = None


class PushTokenRequest(BaseModel):
    token: str = Field(..., min_length=1)

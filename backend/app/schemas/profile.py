from pydantic import BaseModel
from datetime import datetime


class ProfileResponse(BaseModel):
    id: str
    email: str | None
    full_name: str | None
    avatar_url: str | None
    push_token: str | None
    created_at: datetime
    updated_at: datetime


class ProfileUpdateRequest(BaseModel):
    full_name: str | None = None
    avatar_url: str | None = None

import re
from typing import Any

from pydantic import BaseModel, Field, field_validator

EXPO_TOKEN_RE = re.compile(r'^ExponentPushToken\[.+\]$|^[a-zA-Z0-9_\-]{20,}$')


class RegisterTokenRequest(BaseModel):
    token: str

    @field_validator("token")
    @classmethod
    def token_must_be_valid(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("token must not be empty")
        if not EXPO_TOKEN_RE.match(v):
            raise ValueError("Invalid Expo push token format")
        return v


class RegisterTokenResponse(BaseModel):
    message: str


class SendNotificationRequest(BaseModel):
    to_user_id: str = Field(..., min_length=1)
    title: str = Field(..., max_length=255)
    body: str = Field(..., max_length=1024)
    data: dict[str, Any] = Field(default_factory=dict)


class SendNotificationResponse(BaseModel):
    success: bool
    message: str

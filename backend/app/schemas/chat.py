"""Chat schemas — thread and message request/response models."""
from datetime import datetime

from pydantic import BaseModel, Field, field_validator


class ChatThreadCreate(BaseModel):
    merchant_id: str


class MerchantStub(BaseModel):
    id: str
    name: str
    avatar_url: str | None = None


class ChatThreadResponse(BaseModel):
    id: str
    user_id: str
    merchant_id: str
    merchant: MerchantStub | None = None
    last_message: str | None = None        # preview of most recent message
    last_message_at: datetime | None = None
    unread_count: int = 0                   # caller-perspective
    created_at: datetime


class ChatMessageCreate(BaseModel):
    content: str = Field(..., min_length=1, max_length=2000)

    @field_validator("content")
    @classmethod
    def content_not_whitespace_only(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("content must not be whitespace only")
        return v


class ChatMessageResponse(BaseModel):
    id: str
    thread_id: str
    sender_id: str
    content: str
    read_by_user: bool = False
    read_by_merchant: bool = False
    created_at: datetime


class MarkReadResponse(BaseModel):
    marked_read: int


class ChatThreadListResponse(BaseModel):
    data: list[ChatThreadResponse]
    has_more: bool
    next_cursor: str | None = None


class ChatMessageListResponse(BaseModel):
    data: list[ChatMessageResponse]
    has_more: bool
    next_cursor: str | None = None

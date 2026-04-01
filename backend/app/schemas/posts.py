"""Posts schemas — create/update/respond for merchant posts."""
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class PostCreate(BaseModel):
    content: str = Field(..., min_length=1, max_length=500)
    post_type: str = Field(..., pattern="^(offer|update)$")
    image_url: str | None = None
    service_id: str | None = None


class PostUpdate(BaseModel):
    content: str | None = Field(default=None, max_length=500)
    service_id: str | None = None


class MerchantStub(BaseModel):
    """Minimal merchant info embedded in post responses."""
    id: UUID
    name: str
    avatar_url: str | None = None


class PostResponse(BaseModel):
    id: UUID
    merchant_id: UUID
    merchant: MerchantStub
    content: str
    image_url: str | None = None
    post_type: str
    like_count: int = 0
    comment_count: int = 0
    is_liked_by_me: bool = False
    created_at: datetime


class PostListResponse(BaseModel):
    data: list[PostResponse]
    count: int
    next_cursor: str | None = None


class LikeResponse(BaseModel):
    liked: bool

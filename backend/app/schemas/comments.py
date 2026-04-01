"""Comments schemas — create/update/respond for post comments."""
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class CommentCreate(BaseModel):
    content: str = Field(..., min_length=1)


class CommentUpdate(BaseModel):
    content: str = Field(..., min_length=1)


class UserStub(BaseModel):
    """Minimal user profile embedded in comment responses."""
    id: UUID
    full_name: str | None = None
    avatar_url: str | None = None


class CommentResponse(BaseModel):
    id: UUID
    post_id: UUID
    user: UserStub
    content: str
    created_at: datetime


class CommentListResponse(BaseModel):
    data: list[CommentResponse]
    count: int

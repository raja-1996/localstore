"""Reviews schemas — create/update/respond for merchant reviews."""
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class ReviewCreate(BaseModel):
    rating: int = Field(..., ge=1, le=5)
    body: str | None = None


class ReviewUpdate(BaseModel):
    rating: int | None = Field(default=None, ge=1, le=5)
    body: str | None = None


class ReviewerStub(BaseModel):
    """Minimal user profile embedded in review responses."""
    id: UUID
    full_name: str | None = None
    avatar_url: str | None = None


class ReviewResponse(BaseModel):
    id: UUID
    merchant_id: UUID
    reviewer: ReviewerStub
    rating: int
    body: str | None = None
    is_verified_purchase: bool = False
    created_at: datetime


class ReviewListResponse(BaseModel):
    data: list[ReviewResponse]
    avg_rating: float
    count: int

"""Follows schemas — follow/unfollow, follower/following lists, following feed."""
from datetime import datetime

from pydantic import BaseModel

from app.schemas.merchants import MerchantCard


class FollowResponse(BaseModel):
    merchant_id: str
    followed_at: datetime


class ProfileStub(BaseModel):
    """Minimal user profile for follower lists."""
    id: str
    display_name: str | None = None
    avatar_url: str | None = None


class FollowerListResponse(BaseModel):
    data: list[ProfileStub]
    count: int


class FollowingListResponse(BaseModel):
    data: list[MerchantCard]
    count: int


class PostMerchantStub(BaseModel):
    """Minimal merchant stub embedded in following feed posts."""
    id: str
    business_name: str
    avatar_url: str | None = None


class FollowingFeedPost(BaseModel):
    """A single post in the following feed."""
    id: str
    merchant: PostMerchantStub
    content: str
    image_url: str | None = None
    post_type: str
    like_count: int = 0
    comment_count: int = 0
    created_at: datetime


class FollowingFeedResponse(BaseModel):
    """Cursor-paginated response for GET /feed/following."""
    data: list[FollowingFeedPost]
    has_more: bool
    next_cursor: str | None = None

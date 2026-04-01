"""Feed schemas — NearbyFeedItem with type discriminator, cursor-paginated response."""
from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.merchants import MerchantCategory


class NearbyFeedItem(BaseModel):
    """A single item in the nearby feed. Currently merchants only; posts added in MVP 3."""
    type: Literal["merchant"] = "merchant"
    id: str
    name: str
    category: MerchantCategory
    lat: float
    lng: float
    avg_rating: Decimal = Field(default=Decimal("0"), ge=0, le=5)
    review_count: int = 0
    follower_count: int = 0
    is_verified: bool = False
    distance_meters: float
    # Optional fields for richer card display
    description: str | None = None
    neighborhood: str | None = None
    tags: list[str] | None = None


class NearbyFeedResponse(BaseModel):
    """Cursor-paginated response for /feed/nearby."""
    data: list[NearbyFeedItem]
    has_more: bool
    next_cursor: str | None = None

"""Search schemas — SearchResponse with merchants and services lists."""
from decimal import Decimal

from pydantic import BaseModel, Field

from app.schemas.merchants import MerchantCategory


class SearchMerchantItem(BaseModel):
    """Merchant result in search response."""
    id: str
    name: str
    category: MerchantCategory
    lat: float
    lng: float
    avg_rating: Decimal = Field(default=Decimal("0"), ge=0, le=5)
    review_count: int = 0
    follower_count: int = 0
    is_verified: bool = False
    distance_meters: float | None = None
    neighborhood: str | None = None
    rank_score: float | None = Field(default=None, exclude=True)


class ServiceMerchantBrief(BaseModel):
    """Minimal merchant info embedded in a service search result."""
    id: str
    name: str


class SearchServiceItem(BaseModel):
    """Service result in search response."""
    id: str
    merchant: ServiceMerchantBrief
    name: str
    description: str | None = None
    price: Decimal | None = None
    price_unit: str | None = None
    image_url: str | None = None
    distance_meters: float | None = None
    rank_score: float | None = Field(default=None, exclude=True)


class SearchResponse(BaseModel):
    """Combined search response with merchants and services."""
    merchants: list[SearchMerchantItem]
    services: list[SearchServiceItem]

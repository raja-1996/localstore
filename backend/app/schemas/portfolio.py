from datetime import datetime
from pydantic import BaseModel, Field


class PortfolioImageCreate(BaseModel):
    image_url: str
    caption: str | None = None
    sort_order: int = Field(default=0, ge=0)


class PortfolioImageResponse(BaseModel):
    id: str
    merchant_id: str
    image_url: str
    caption: str | None = None
    sort_order: int = Field(default=0, ge=0)
    created_at: datetime


class ReorderRequest(BaseModel):
    order: list[str] = Field(min_length=1)

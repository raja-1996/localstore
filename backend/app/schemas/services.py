from decimal import Decimal
from datetime import datetime
from pydantic import BaseModel, Field


class ServiceBase(BaseModel):
    name: str
    description: str | None = None
    price: Decimal = Field(..., ge=0)
    price_unit: str | None = None
    image_url: str | None = None
    is_available: bool = True
    cancellation_policy: str | None = None
    advance_percent: int = Field(default=20, ge=0, le=100)


class ServiceCreate(ServiceBase):
    pass


class ServiceUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    price: Decimal | None = Field(default=None, ge=0)
    price_unit: str | None = None
    image_url: str | None = None
    is_available: bool | None = None
    cancellation_policy: str | None = None
    advance_percent: int | None = Field(default=None, ge=0, le=100)


class ServiceResponse(BaseModel):
    id: str
    merchant_id: str
    name: str
    description: str | None = None
    price: Decimal
    price_unit: str | None = None
    image_url: str | None = None
    is_available: bool
    cancellation_policy: str | None = None
    advance_percent: int
    created_at: datetime
    updated_at: datetime

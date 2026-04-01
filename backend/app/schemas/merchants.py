from decimal import Decimal
from enum import Enum
from datetime import datetime
from pydantic import BaseModel, Field, model_validator


class MerchantCategory(str, Enum):
    food = "Food"
    tailoring = "Tailoring"
    beauty = "Beauty"
    home_services = "HomeServices"
    events = "Events"
    other = "Other"


# Utility function — not a schema
def mask_phone(phone: str | None) -> str | None:
    if phone is None:
        return None
    last4 = phone[-4:] if len(phone) >= 4 else ""
    return f"*****{last4}"


class MerchantBase(BaseModel):
    name: str
    description: str | None = None
    category: MerchantCategory
    lat: float
    lng: float
    address_text: str | None = None
    neighborhood: str | None = None
    service_radius_meters: int = Field(default=5000, ge=0)
    phone: str | None = None
    whatsapp: str | None = None
    tags: list[str] | None = None
    video_intro_url: str | None = None


class MerchantCreate(MerchantBase):
    pass


class MerchantUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    category: MerchantCategory | None = None
    lat: float | None = None
    lng: float | None = None
    address_text: str | None = None
    neighborhood: str | None = None
    service_radius_meters: int | None = Field(default=None, ge=0)
    phone: str | None = None
    whatsapp: str | None = None
    tags: list[str] | None = None
    video_intro_url: str | None = None


class MerchantCard(BaseModel):
    id: str
    name: str
    category: MerchantCategory
    lat: float
    lng: float
    avg_rating: Decimal = Field(default=Decimal("0"), ge=0, le=5)
    review_count: int
    follower_count: int
    is_verified: bool
    distance_meters: float | None = None

    @model_validator(mode='after')
    def _round_coordinates(self) -> 'MerchantCard':
        self.lat = round(self.lat, 4)
        self.lng = round(self.lng, 4)
        return self


class MerchantDetail(MerchantCard):
    description: str | None = None
    address_text: str | None = None
    neighborhood: str | None = None
    service_radius_meters: int
    tags: list[str] | None = None
    video_intro_url: str | None = None
    phone: str | None = None
    whatsapp: str | None = None
    response_time_minutes: int | None = None
    is_active: bool
    created_at: datetime
    is_following: bool = False
    # is_owner controls whether phone/whatsapp are masked; excluded from API response
    is_owner: bool = Field(default=False, exclude=True)

    @model_validator(mode='after')
    def _mask_contact_fields(self) -> 'MerchantDetail':
        if not self.is_owner:
            self.phone = mask_phone(self.phone)
            self.whatsapp = mask_phone(self.whatsapp)
        return self

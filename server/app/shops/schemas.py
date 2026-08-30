from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, Field


class OpeningHoursOut(BaseModel):
    # day follows Python's date.weekday() convention: 0=Monday..6=Sunday,
    # matching barber_working_hours.day_of_week. The frontend adapts this to
    # its own 0=Sunday convention at the api.ts seam.
    day: int
    open: str | None
    close: str | None


class ServicePublicOut(BaseModel):
    id: UUID
    name: str
    description: str | None
    price: Decimal
    currency: str


class BarberServicePublicOut(BaseModel):
    service_id: UUID
    duration_minutes: int
    price_override: Decimal | None


class BarberPublicOut(BaseModel):
    id: UUID
    shop_id: UUID
    name: str
    bio: str | None
    profile_image_url: str | None
    rating: float
    review_count: int
    services: list[BarberServicePublicOut]


class ShopPublicOut(BaseModel):
    id: UUID
    name: str
    tagline: str
    description: str
    photos: list[str]
    rating: float
    review_count: int
    distance_km: float | None
    area: str
    address: str
    phone: str | None
    timezone: str
    status: str
    hours: list[OpeningHoursOut]


class ShopServicesOut(BaseModel):
    shop: ShopPublicOut
    services: list[ServicePublicOut]
    barbers: list[BarberPublicOut]


class BarberDetailOut(BaseModel):
    barber: BarberPublicOut
    shop: ShopPublicOut


class ShopCreateOut(BaseModel):
    id: UUID
    name: str
    status: str


class ShopCreateIn(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: str | None = None
    phone: str | None = None
    email: str | None = None
    address_line_1: str = Field(min_length=1)
    address_line_2: str | None = None
    city: str = Field(min_length=1)
    state: str | None = None
    postal_code: str | None = None
    country: str = Field(min_length=1)
    latitude: Decimal
    longitude: Decimal
    timezone: str = Field(min_length=1)


class ShopUpdateIn(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = None
    phone: str | None = None
    email: str | None = None
    address_line_1: str | None = Field(default=None, min_length=1)
    address_line_2: str | None = None
    city: str | None = Field(default=None, min_length=1)
    state: str | None = None
    postal_code: str | None = None
    country: str | None = Field(default=None, min_length=1)
    latitude: Decimal | None = None
    longitude: Decimal | None = None
    timezone: str | None = None
    status: str | None = None


class MyShopOut(BaseModel):
    id: UUID
    name: str
    role: str
    status: str

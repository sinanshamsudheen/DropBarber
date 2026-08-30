from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, Field


class ServiceManageOut(BaseModel):
    id: UUID
    shop_id: UUID
    name: str
    description: str | None
    price: Decimal
    currency: str
    status: str


class ServiceCreateIn(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: str | None = None
    price: Decimal = Field(ge=0)
    currency: str = Field(min_length=3, max_length=3)


class ServiceUpdateIn(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = None
    price: Decimal | None = Field(default=None, ge=0)
    currency: str | None = Field(default=None, min_length=3, max_length=3)
    status: str | None = None


class BarberServiceConfigIn(BaseModel):
    is_active: bool = True
    duration_minutes: int = Field(gt=0)
    price_override: Decimal | None = Field(default=None, ge=0)


class BarberServiceConfigOut(BaseModel):
    barber_profile_id: UUID
    service_id: UUID
    is_active: bool
    duration_minutes: int
    price_override: Decimal | None

from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel


class ShopCustomerSummaryOut(BaseModel):
    customer_user_id: UUID
    display_name: str | None
    email: str | None
    phone: str | None
    visits: int
    last_visit: datetime | None
    preferred_barber_id: UUID | None


class ShopAppointmentHistoryItem(BaseModel):
    id: UUID
    barber_id: UUID
    service_id: UUID
    start_at: datetime
    status: str
    final_price: Decimal | None


class ShopCustomerDetailOut(ShopCustomerSummaryOut):
    notes: str | None
    appointments: list[ShopAppointmentHistoryItem]
    reference_media_ids: list[UUID]


class ShopCustomerUpdateIn(BaseModel):
    preferred_barber_id: UUID | None = None
    notes: str | None = None


class ShopCustomerUpdateOut(BaseModel):
    customer_user_id: UUID
    notes: str | None
    preferred_barber_id: UUID | None


class CustomerHistoryItem(BaseModel):
    appointment_id: UUID
    shop_id: UUID
    shop_name: str
    barber_id: UUID
    service_id: UUID
    start_at: datetime
    status: str
    final_price: Decimal | None

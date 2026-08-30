from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, Field


class AppointmentCreateIn(BaseModel):
    shop_id: UUID
    barber_id: UUID
    service_id: UUID
    start_at: datetime
    booking_note: str | None = None
    reference_media_ids: list[UUID] = Field(default_factory=list)


class AppointmentRescheduleIn(BaseModel):
    start_at: datetime
    barber_id: UUID | None = None
    service_id: UUID | None = None


class AppointmentCompleteIn(BaseModel):
    actual_service_id: UUID | None = None
    final_price: Decimal | None = Field(default=None, ge=0)
    notes: str | None = None
    finished_cut_media_id: UUID | None = None


class AppointmentDetailsOut(BaseModel):
    actual_service_id: UUID | None
    final_price: Decimal | None
    notes: str | None
    completed_by_member_id: UUID


class AppointmentOut(BaseModel):
    id: UUID
    shop_id: UUID
    barber_id: UUID
    service_id: UUID
    customer_user_id: UUID
    start_at: datetime
    end_at: datetime
    status: str
    booking_note: str | None
    cancelled_at: datetime | None
    completed_at: datetime | None
    created_at: datetime
    details: AppointmentDetailsOut | None = None


class RescheduleOut(BaseModel):
    old_appointment_id: UUID
    appointment: AppointmentOut

from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, Numeric, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.db.mixins import TimestampMixin, UUIDPrimaryKeyMixin
from app.db.sql import check_in

APPOINTMENT_STATUSES = ("booked", "completed", "cancelled", "no_show")


class Appointment(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """The central booking entity. Selected shop/barber/service/time are
    stored directly on the row so historical bookings stay accurate even if
    shop configuration (e.g. a barber's service duration) changes later.

    Overlap protection for the same barber is enforced by a GiST exclusion
    constraint added in the Phase 2 migration (not representable in plain
    SQLAlchemy Core), not by application code alone.
    """

    __tablename__ = "appointments"
    __table_args__ = (
        CheckConstraint("start_at < end_at", name="start_before_end"),
        CheckConstraint(check_in("status", APPOINTMENT_STATUSES), name="status"),
        Index("ix_appointments_shop_id_start_at", "shop_id", "start_at"),
        Index("ix_appointments_barber_profile_id_start_at", "barber_profile_id", "start_at"),
        Index("ix_appointments_customer_user_id_start_at", "customer_user_id", "start_at"),
        Index("ix_appointments_shop_id_status_start_at", "shop_id", "status", "start_at"),
    )

    shop_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("shops.id"), nullable=False)
    customer_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    barber_profile_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("barber_profiles.id"), nullable=False
    )
    service_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("services.id"), nullable=False
    )
    start_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    end_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    status: Mapped[str] = mapped_column(Text, nullable=False, default="booked")
    booking_note: Mapped[str | None] = mapped_column(Text, default=None)
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)


class AppointmentDetails(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Optional post-appointment CRM information, deliberately separate from
    the booking record itself. actual_service_id lets a barber record what
    was actually performed if it differs from what was booked.
    """

    __tablename__ = "appointment_details"
    __table_args__ = (
        UniqueConstraint("appointment_id", name="uq_appointment_details_appointment_id"),
        CheckConstraint("final_price IS NULL OR final_price >= 0", name="final_price_non_negative"),
    )

    appointment_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("appointments.id", ondelete="CASCADE"), nullable=False
    )
    actual_service_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("services.id"), default=None
    )
    final_price: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), default=None)
    notes: Mapped[str | None] = mapped_column(Text, default=None)
    completed_by_member_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("shop_members.id"), nullable=False
    )

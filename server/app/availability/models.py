from __future__ import annotations

import uuid
from datetime import datetime, time

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, Index, SmallInteger, Text, Time
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.db.mixins import TimestampMixin, UUIDPrimaryKeyMixin


class BarberWorkingHours(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Recurring weekly availability. A barber can have multiple periods on
    the same day (e.g. 09:00-13:00 and 14:00-18:00 on Monday).

    day_of_week follows Python's `date.weekday()` convention: 0 = Monday,
    6 = Sunday. No availability calculation happens in this phase.
    """

    __tablename__ = "barber_working_hours"
    __table_args__ = (
        CheckConstraint("day_of_week BETWEEN 0 AND 6", name="day_of_week_range"),
        CheckConstraint("start_time < end_time", name="start_before_end"),
        Index("ix_barber_working_hours_barber_profile_id_day_of_week", "barber_profile_id", "day_of_week"),
    )

    barber_profile_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("barber_profiles.id"), nullable=False
    )
    day_of_week: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    start_time: Mapped[time] = mapped_column(Time, nullable=False)
    end_time: Mapped[time] = mapped_column(Time, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)


class BarberTimeOff(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Exceptions to recurring availability — leave, holidays, temporary unavailability."""

    __tablename__ = "barber_time_off"
    __table_args__ = (
        CheckConstraint("start_at < end_at", name="start_before_end"),
        Index("ix_barber_time_off_barber_profile_id_start_at", "barber_profile_id", "start_at"),
        Index(
            "ix_barber_time_off_barber_profile_id_start_at_end_at",
            "barber_profile_id",
            "start_at",
            "end_at",
        ),
    )

    barber_profile_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("barber_profiles.id"), nullable=False
    )
    start_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    end_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    reason: Mapped[str | None] = mapped_column(Text, default=None)

from __future__ import annotations

import uuid

from sqlalchemy import CheckConstraint, ForeignKey, Index, Integer, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.db.mixins import CreatedAtMixin, UUIDPrimaryKeyMixin


class BarberPoint(UUIDPrimaryKeyMixin, CreatedAtMixin, Base):
    """An operational incentive point awarded to a barber for a qualifying
    action (e.g. completing an appointment record). Append-only ledger — no
    rewards/badges/levels/redemption in this phase.
    """

    __tablename__ = "barber_points"
    __table_args__ = (
        UniqueConstraint("appointment_id", "reason", name="uq_barber_points_appointment_id_reason"),
        CheckConstraint("points > 0", name="points_positive"),
        Index("ix_barber_points_barber_profile_id_created_at", "barber_profile_id", "created_at"),
    )

    barber_profile_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("barber_profiles.id"), nullable=False
    )
    appointment_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("appointments.id"), nullable=False, index=True
    )
    points: Mapped[int] = mapped_column(Integer, nullable=False)
    reason: Mapped[str] = mapped_column(Text, nullable=False)

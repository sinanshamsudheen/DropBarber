from __future__ import annotations

import uuid

from sqlalchemy import CheckConstraint, ForeignKey, Index, SmallInteger, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.db.mixins import TimestampMixin, UUIDPrimaryKeyMixin


class Review(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """A customer review for a completed appointment. One review per
    appointment (its shop/barber relationship is preserved even if shop
    configuration changes later — that's why shop_id/barber_profile_id are
    stored directly rather than derived from the appointment at read time).
    """

    __tablename__ = "reviews"
    __table_args__ = (
        UniqueConstraint("appointment_id", name="uq_reviews_appointment_id"),
        CheckConstraint("rating BETWEEN 1 AND 5", name="rating_range"),
        Index("ix_reviews_shop_id_created_at", "shop_id", "created_at"),
        Index("ix_reviews_barber_profile_id_created_at", "barber_profile_id", "created_at"),
        Index("ix_reviews_customer_user_id_created_at", "customer_user_id", "created_at"),
    )

    appointment_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("appointments.id"), nullable=False
    )
    shop_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("shops.id"), nullable=False)
    customer_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    barber_profile_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("barber_profiles.id"), default=None
    )
    rating: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    review_text: Mapped[str | None] = mapped_column(Text, default=None)

from __future__ import annotations

import uuid
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.db.mixins import TimestampMixin, UUIDPrimaryKeyMixin
from app.db.sql import check_in

SERVICE_STATUSES = ("active", "inactive")


class Service(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """A service offered by a single shop. No global service catalog — each
    shop defines and prices its own services.
    """

    __tablename__ = "services"
    __table_args__ = (
        UniqueConstraint("shop_id", "name", name="uq_services_shop_id_name"),
        CheckConstraint("price >= 0", name="price_non_negative"),
        CheckConstraint(check_in("status", SERVICE_STATUSES), name="status"),
        Index("ix_services_shop_id_status", "shop_id", "status"),
    )

    shop_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("shops.id"), nullable=False)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, default=None)
    price: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False)
    status: Mapped[str] = mapped_column(Text, nullable=False, default="active")


class BarberService(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """A barber's own duration/price for a service — duration and pricing are
    always barber-specific, never a single value shared across all barbers.
    """

    __tablename__ = "barber_services"
    __table_args__ = (
        UniqueConstraint("barber_profile_id", "service_id", name="uq_barber_services_barber_service"),
        CheckConstraint("duration_minutes > 0", name="duration_positive"),
        CheckConstraint("price_override IS NULL OR price_override >= 0", name="price_non_negative"),
        Index("ix_barber_services_barber_profile_id_is_active", "barber_profile_id", "is_active"),
        Index("ix_barber_services_service_id_is_active", "service_id", "is_active"),
    )

    barber_profile_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("barber_profiles.id"), nullable=False
    )
    service_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("services.id"), nullable=False
    )
    duration_minutes: Mapped[int] = mapped_column(Integer, nullable=False)
    price_override: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), default=None)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

from __future__ import annotations

import uuid

from sqlalchemy import ForeignKey, Index, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.db.mixins import TimestampMixin, UUIDPrimaryKeyMixin


class CustomerProfile(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Platform-level customer profile. Never holds shop-specific CRM data —
    that lives in ShopCustomer.
    """

    __tablename__ = "customer_profiles"
    __table_args__ = (UniqueConstraint("user_id", name="uq_customer_profiles_user_id"),)

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    display_name: Mapped[str | None] = mapped_column(default=None)
    phone: Mapped[str | None] = mapped_column(default=None)
    avatar_url: Mapped[str | None] = mapped_column(default=None)


class ShopCustomer(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """The shop-scoped CRM relationship between a customer and one shop.

    This is the core tenancy boundary: a shop must only ever see its own
    ShopCustomer row for a given customer, never another shop's.
    """

    __tablename__ = "shop_customers"
    __table_args__ = (
        UniqueConstraint("shop_id", "customer_user_id", name="uq_shop_customers_shop_id_customer_user_id"),
        Index("ix_shop_customers_shop_id_preferred_barber_id", "shop_id", "preferred_barber_id"),
    )

    shop_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("shops.id"), nullable=False, index=True
    )
    customer_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    preferred_barber_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("barber_profiles.id"), default=None
    )
    notes: Mapped[str | None] = mapped_column(Text, default=None)

from __future__ import annotations

import uuid

from sqlalchemy import CheckConstraint, ForeignKey, Index, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.db.mixins import TimestampMixin, UUIDPrimaryKeyMixin
from app.db.sql import check_in

SHOP_MEMBER_ROLES = ("owner", "manager", "barber")
SHOP_MEMBER_STATUSES = ("active", "inactive")
BARBER_PROFILE_STATUSES = ("active", "inactive")


class ShopMember(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Associates a user with a shop and establishes the shop-level RBAC/RLS boundary."""

    __tablename__ = "shop_members"
    __table_args__ = (
        UniqueConstraint("shop_id", "user_id", name="uq_shop_members_shop_id_user_id"),
        CheckConstraint(check_in("role", SHOP_MEMBER_ROLES), name="role"),
        CheckConstraint(check_in("status", SHOP_MEMBER_STATUSES), name="status"),
        Index("ix_shop_members_shop_id_role", "shop_id", "role"),
        Index("ix_shop_members_shop_id_status", "shop_id", "status"),
    )

    shop_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("shops.id"), nullable=False)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )
    role: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(Text, nullable=False, default="active")


class BarberProfile(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Barber-specific information for a shop member. A barber is always
    scoped to one shop through its shop_member row — never a global identity.
    """

    __tablename__ = "barber_profiles"
    __table_args__ = (
        UniqueConstraint("shop_member_id", name="uq_barber_profiles_shop_member_id"),
        CheckConstraint(check_in("status", BARBER_PROFILE_STATUSES), name="status"),
    )

    shop_member_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("shop_members.id"), nullable=False
    )
    display_name: Mapped[str] = mapped_column(Text, nullable=False)
    bio: Mapped[str | None] = mapped_column(Text, default=None)
    profile_image_url: Mapped[str | None] = mapped_column(default=None)
    status: Mapped[str] = mapped_column(Text, nullable=False, default="active", index=True)

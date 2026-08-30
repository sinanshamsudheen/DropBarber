from __future__ import annotations

import uuid

from sqlalchemy import CheckConstraint, ForeignKey, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.db.mixins import CreatedAtMixin, UUIDPrimaryKeyMixin
from app.db.sql import check_in

# Technical media kind. Only images are relevant in v1; extend this set
# (and add a migration) if video or other formats are ever needed.
MEDIA_ASSET_TYPES = ("image",)
APPOINTMENT_MEDIA_TYPES = ("customer_reference", "finished_cut")


class MediaAsset(UUIDPrimaryKeyMixin, CreatedAtMixin, Base):
    """Metadata for a file stored in Supabase Storage. No binary data lives
    in Postgres, and rows are never public by default — visibility is
    controlled by whatever links to them (AppointmentMedia /
    CustomerPreferenceMedia) plus storage-level access rules.
    """

    __tablename__ = "media_assets"
    __table_args__ = (CheckConstraint(check_in("media_type", MEDIA_ASSET_TYPES), name="media_type"),)

    uploaded_by_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    storage_path: Mapped[str] = mapped_column(Text, nullable=False)
    media_type: Mapped[str] = mapped_column(Text, nullable=False)


class AppointmentMedia(UUIDPrimaryKeyMixin, CreatedAtMixin, Base):
    """Associates media with a specific appointment, tagged as a customer
    reference photo or a finished-cut photo — keeps a booking-time reference
    image from silently becoming a permanent customer preference.
    """

    __tablename__ = "appointment_media"
    __table_args__ = (
        UniqueConstraint(
            "appointment_id", "media_asset_id", name="uq_appointment_media_appointment_id_media_asset_id"
        ),
        CheckConstraint(check_in("media_type", APPOINTMENT_MEDIA_TYPES), name="media_type"),
    )

    appointment_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("appointments.id", ondelete="CASCADE"), nullable=False
    )
    media_asset_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("media_assets.id"), nullable=False
    )
    media_type: Mapped[str] = mapped_column(Text, nullable=False)


class CustomerPreferenceMedia(UUIDPrimaryKeyMixin, CreatedAtMixin, Base):
    """A customer-level saved reference/preference image — distinct from an
    appointment-specific reference.
    """

    __tablename__ = "customer_preference_media"

    customer_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    media_asset_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("media_assets.id"), nullable=False
    )
    caption: Mapped[str | None] = mapped_column(Text, default=None)

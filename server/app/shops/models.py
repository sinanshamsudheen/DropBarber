from __future__ import annotations

from decimal import Decimal

from geoalchemy2 import Geography
from sqlalchemy import CheckConstraint, Computed, Numeric, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.db.mixins import TimestampMixin, UUIDPrimaryKeyMixin
from app.db.sql import check_in

SHOP_STATUSES = ("pending", "active", "inactive")


class Shop(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """A single bookable barber shop location. No `branches` concept yet —
    one shop row is one physical, bookable location.
    """

    __tablename__ = "shops"
    __table_args__ = (CheckConstraint(check_in("status", SHOP_STATUSES), name="status"),)

    name: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, default=None)
    phone: Mapped[str | None] = mapped_column(default=None)
    email: Mapped[str | None] = mapped_column(default=None)

    address_line_1: Mapped[str] = mapped_column(Text, nullable=False)
    address_line_2: Mapped[str | None] = mapped_column(Text, default=None)
    city: Mapped[str] = mapped_column(nullable=False)
    state: Mapped[str | None] = mapped_column(default=None)
    postal_code: Mapped[str | None] = mapped_column(default=None)
    country: Mapped[str] = mapped_column(nullable=False)

    latitude: Mapped[Decimal] = mapped_column(Numeric(9, 6), nullable=False)
    longitude: Mapped[Decimal] = mapped_column(Numeric(9, 6), nullable=False)
    # Derived from latitude/longitude for spatial (radius/nearby) queries;
    # source of truth stays latitude/longitude. GiST index added in the
    # migration (spatial_index=False here to avoid double-defining it).
    location: Mapped[str | None] = mapped_column(
        Geography(geometry_type="POINT", srid=4326, spatial_index=False),
        Computed("ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography", persisted=True),
    )

    # IANA timezone name, e.g. "America/New_York". Used for local scheduling
    # (availability calculations) later; all stored timestamps stay UTC.
    timezone: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(Text, nullable=False, default="pending", index=True)

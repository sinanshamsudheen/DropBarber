from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.availability.models import BarberWorkingHours
from app.core.config import Settings
from app.media.models import MediaAsset, ShopPhoto
from app.media.storage import build_public_shop_media_url
from app.reviews.models import Review
from app.services.models import BarberService
from app.shops.models import Shop
from app.shops.schemas import BarberPublicOut, BarberServicePublicOut, OpeningHoursOut, ShopPublicOut
from app.staff.models import BarberProfile, ShopMember


def derive_tagline(description: str | None) -> str:
    """First sentence of the description — shops have no dedicated tagline
    field in the Phase 2 schema."""
    if not description:
        return ""
    first_sentence = description.split(".")[0].strip()
    return first_sentence[:140]


async def compute_rating_summary(db: AsyncSession, shop_id: UUID) -> tuple[float, int]:
    result = await db.execute(
        select(func.avg(Review.rating), func.count(Review.id)).where(Review.shop_id == shop_id)
    )
    avg_rating, count = result.one()
    return (round(float(avg_rating), 2) if avg_rating is not None else 0.0, count or 0)


async def compute_shop_hours(db: AsyncSession, shop_id: UUID) -> list[OpeningHoursOut]:
    """Best-effort shop-level hours: the union (earliest open, latest close)
    across that shop's active barbers' working hours per day. Phase 2 has no
    shop-level opening-hours table — this is a real aggregation of existing
    data, not a new feature.
    """
    result = await db.execute(
        select(
            BarberWorkingHours.day_of_week,
            func.min(BarberWorkingHours.start_time),
            func.max(BarberWorkingHours.end_time),
        )
        .join(BarberProfile, BarberProfile.id == BarberWorkingHours.barber_profile_id)
        .join(ShopMember, ShopMember.id == BarberProfile.shop_member_id)
        .where(
            ShopMember.shop_id == shop_id,
            BarberProfile.status == "active",
            BarberWorkingHours.is_active.is_(True),
        )
        .group_by(BarberWorkingHours.day_of_week)
    )
    by_day = {day: (start, end) for day, start, end in result}
    return [
        OpeningHoursOut(
            day=day,
            open=by_day[day][0].strftime("%H:%M") if day in by_day else None,
            close=by_day[day][1].strftime("%H:%M") if day in by_day else None,
        )
        for day in range(7)
    ]


async def compute_barber_rating_summary(db: AsyncSession, barber_profile_id: UUID) -> tuple[float, int]:
    result = await db.execute(
        select(func.avg(Review.rating), func.count(Review.id)).where(
            Review.barber_profile_id == barber_profile_id
        )
    )
    avg_rating, count = result.one()
    return (round(float(avg_rating), 2) if avg_rating is not None else 0.0, count or 0)


async def build_barber_public_out(db: AsyncSession, barber: BarberProfile, shop_id: UUID) -> BarberPublicOut:
    rating, review_count = await compute_barber_rating_summary(db, barber.id)
    services_result = await db.execute(
        select(BarberService).where(
            BarberService.barber_profile_id == barber.id, BarberService.is_active.is_(True)
        )
    )
    services = [
        BarberServicePublicOut(
            service_id=bs.service_id, duration_minutes=bs.duration_minutes, price_override=bs.price_override
        )
        for bs in services_result.scalars()
    ]
    return BarberPublicOut(
        id=barber.id,
        shop_id=shop_id,
        name=barber.display_name,
        bio=barber.bio,
        profile_image_url=barber.profile_image_url,
        rating=rating,
        review_count=review_count,
        services=services,
    )


async def compute_shop_photo_urls(db: AsyncSession, shop_id: UUID, settings: Settings) -> list[str]:
    result = await db.execute(
        select(MediaAsset.storage_path)
        .join(ShopPhoto, ShopPhoto.media_asset_id == MediaAsset.id)
        .where(ShopPhoto.shop_id == shop_id)
        .order_by(ShopPhoto.created_at.asc())
    )
    return [build_public_shop_media_url(path, settings) for path in result.scalars()]


async def build_shop_public_out(
    db: AsyncSession, shop: Shop, settings: Settings, distance_km: float | None = None
) -> ShopPublicOut:
    rating, review_count = await compute_rating_summary(db, shop.id)
    hours = await compute_shop_hours(db, shop.id)
    photos = await compute_shop_photo_urls(db, shop.id, settings)
    address = ", ".join(part for part in [shop.address_line_1, shop.address_line_2, shop.city] if part)
    return ShopPublicOut(
        id=shop.id,
        name=shop.name,
        tagline=derive_tagline(shop.description),
        description=shop.description or "",
        photos=photos,
        rating=rating,
        review_count=review_count,
        distance_km=round(distance_km, 2) if distance_km is not None else None,
        area=shop.city,
        address=address,
        phone=shop.phone,
        timezone=shop.timezone,
        status=shop.status,
        hours=hours,
    )

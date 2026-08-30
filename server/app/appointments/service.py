import uuid
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.appointments.models import Appointment
from app.availability.service import get_available_slots
from app.core.errors import BadRequestError, ConflictError, NotFoundError
from app.customers.models import ShopCustomer
from app.services.models import BarberService, Service
from app.shops.models import Shop
from app.staff.models import BarberProfile, ShopMember

EXCLUSION_CONSTRAINT_NAME = "ck_appointments_no_overlap"


async def _load_booking_context(
    db: AsyncSession, *, shop_id: uuid.UUID, barber_id: uuid.UUID, service_id: uuid.UUID
) -> tuple[Shop, BarberProfile, Service, BarberService]:
    shop = await db.get(Shop, shop_id)
    if shop is None:
        raise NotFoundError("Shop not found.")
    if shop.status != "active":
        raise ConflictError(code="BARBER_UNAVAILABLE", message="This shop isn't currently bookable.")

    barber = await db.get(BarberProfile, barber_id)
    if barber is None:
        raise BadRequestError(code="INVALID_BARBER", message="Barber not found.")
    if barber.status != "active":
        raise ConflictError(code="BARBER_UNAVAILABLE", message="This barber isn't currently bookable.")

    member = await db.get(ShopMember, barber.shop_member_id)
    if member is None or member.shop_id != shop_id:
        raise BadRequestError(code="INVALID_BARBER", message="Barber does not belong to this shop.")

    service = await db.get(Service, service_id)
    if service is None or service.shop_id != shop_id:
        raise BadRequestError(code="INVALID_SERVICE", message="Service does not belong to this shop.")
    if service.status != "active":
        raise BadRequestError(code="INVALID_SERVICE", message="This service is not currently offered.")

    barber_service_result = await db.execute(
        select(BarberService).where(
            BarberService.barber_profile_id == barber_id,
            BarberService.service_id == service_id,
            BarberService.is_active.is_(True),
        )
    )
    barber_service = barber_service_result.scalar_one_or_none()
    if barber_service is None:
        raise BadRequestError(code="INVALID_SERVICE", message="This barber does not provide that service.")

    return shop, barber, service, barber_service


async def create_appointment_transactionally(
    db: AsyncSession,
    *,
    customer_user_id: uuid.UUID,
    shop_id: uuid.UUID,
    barber_id: uuid.UUID,
    service_id: uuid.UUID,
    start_at: datetime,
    booking_note: str | None,
) -> Appointment:
    """The one shared booking transaction, reused by both create and
    reschedule. Recalculates availability server-side, then relies on
    Phase 2's GiST exclusion constraint as the final concurrency guarantee
    against a genuinely simultaneous booking attempt.
    """
    shop, _barber, _service, barber_service = await _load_booking_context(
        db, shop_id=shop_id, barber_id=barber_id, service_id=service_id
    )
    tz = ZoneInfo(shop.timezone)
    duration = timedelta(minutes=barber_service.duration_minutes)
    end_at = start_at + duration

    available_slots = await get_available_slots(
        db,
        barber_profile_id=barber_id,
        shop_timezone=shop.timezone,
        duration_minutes=barber_service.duration_minutes,
        target_date=start_at.astimezone(tz).date(),
    )
    local_start_time = start_at.astimezone(tz).timetz().replace(tzinfo=None)
    if local_start_time not in available_slots:
        raise ConflictError(
            code="APPOINTMENT_SLOT_UNAVAILABLE", message="The selected time is no longer available."
        )

    appointment = Appointment(
        shop_id=shop_id,
        customer_user_id=customer_user_id,
        barber_profile_id=barber_id,
        service_id=service_id,
        start_at=start_at,
        end_at=end_at,
        status="booked",
        booking_note=booking_note,
    )
    db.add(appointment)
    try:
        await db.flush()
    except IntegrityError as exc:
        if EXCLUSION_CONSTRAINT_NAME in str(exc.orig):
            raise ConflictError(
                code="APPOINTMENT_SLOT_UNAVAILABLE", message="The selected time is no longer available."
            ) from exc
        raise

    await db.execute(
        pg_insert(ShopCustomer)
        .values(shop_id=shop_id, customer_user_id=customer_user_id)
        .on_conflict_do_nothing(index_elements=["shop_id", "customer_user_id"])
    )

    await db.refresh(appointment)
    return appointment

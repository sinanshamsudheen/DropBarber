from datetime import date as date_
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.auth.schemas import AuthenticatedUser
from app.availability.models import BarberTimeOff, BarberWorkingHours
from app.availability.schemas import (
    AvailabilityOut,
    ScheduleOut,
    SlotOut,
    TimeOffCreateIn,
    TimeOffOut,
    WorkingHoursPeriodIn,
    WorkingHoursPeriodOut,
)
from app.availability.service import get_available_slots
from app.core.errors import AuthorizationError, BadRequestError, NotFoundError
from app.core.responses import Envelope, envelope
from app.db.session import get_rls_db
from app.permissions.dependencies import get_shop_membership
from app.services.models import BarberService, Service
from app.shops.models import Shop
from app.staff.models import BarberProfile, ShopMember

router = APIRouter(tags=["availability"])


async def _get_barber_or_404(
    db: AsyncSession, shop_id: UUID, barber_id: UUID
) -> tuple[BarberProfile, ShopMember]:
    result = await db.execute(
        select(BarberProfile, ShopMember)
        .join(ShopMember, ShopMember.id == BarberProfile.shop_member_id)
        .where(BarberProfile.id == barber_id, ShopMember.shop_id == shop_id)
    )
    row = result.first()
    if row is None:
        raise NotFoundError("Barber not found for this shop.")
    barber, member = row
    return barber, member


async def _authorize_schedule_actor(
    db: AsyncSession, user: AuthenticatedUser, shop_id: UUID, barber_id: UUID
) -> None:
    """Authorized barber (self) or owner/manager, per the schedule endpoints'
    'barber themselves or authorized manager/owner' rule."""
    _barber, member = await _get_barber_or_404(db, shop_id, barber_id)
    if member.user_id == user.id:
        return
    membership = await get_shop_membership(shop_id=shop_id, user=user, db=db)
    if membership is None or membership.role not in ("owner", "manager"):
        raise AuthorizationError()


@router.get("/shops/{shop_id}/barbers/{barber_id}/availability", response_model=Envelope[AvailabilityOut])
async def get_availability(
    shop_id: UUID,
    barber_id: UUID,
    service_id: UUID = Query(...),
    date: date_ = Query(...),
    db: AsyncSession = Depends(get_rls_db),
) -> Envelope[AvailabilityOut]:
    """Public. The backend is the authoritative availability engine — the
    frontend never calculates this itself.
    """
    shop = await db.get(Shop, shop_id)
    if shop is None or shop.status != "active":
        raise NotFoundError("Shop not found.")

    barber_result = await db.execute(
        select(BarberProfile)
        .join(ShopMember, ShopMember.id == BarberProfile.shop_member_id)
        .where(BarberProfile.id == barber_id, ShopMember.shop_id == shop_id, BarberProfile.status == "active")
    )
    if barber_result.scalar_one_or_none() is None:
        raise NotFoundError("Barber not found for this shop.")

    service = await db.get(Service, service_id)
    if service is None or service.shop_id != shop_id or service.status != "active":
        raise BadRequestError(code="INVALID_SERVICE", message="Service does not belong to this shop.")

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

    slots = await get_available_slots(
        db,
        barber_profile_id=barber_id,
        shop_timezone=shop.timezone,
        duration_minutes=barber_service.duration_minutes,
        target_date=date,
    )
    return envelope(
        AvailabilityOut(
            slots=[SlotOut(time=s, duration_minutes=barber_service.duration_minutes) for s in slots],
            duration_minutes=barber_service.duration_minutes,
        )
    )


@router.get("/shops/{shop_id}/barbers/{barber_id}/schedule", response_model=Envelope[ScheduleOut])
async def get_schedule(
    shop_id: UUID,
    barber_id: UUID,
    user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_rls_db),
) -> Envelope[ScheduleOut]:
    await _authorize_schedule_actor(db, user, shop_id, barber_id)

    hours_result = await db.execute(
        select(BarberWorkingHours)
        .where(BarberWorkingHours.barber_profile_id == barber_id)
        .order_by(BarberWorkingHours.day_of_week, BarberWorkingHours.start_time)
    )
    time_off_result = await db.execute(
        select(BarberTimeOff)
        .where(BarberTimeOff.barber_profile_id == barber_id)
        .order_by(BarberTimeOff.start_at)
    )
    return envelope(
        ScheduleOut(
            working_hours=[
                WorkingHoursPeriodOut.model_validate(h, from_attributes=True) for h in hours_result.scalars()
            ],
            time_off=[TimeOffOut.model_validate(t, from_attributes=True) for t in time_off_result.scalars()],
        )
    )


@router.put(
    "/shops/{shop_id}/barbers/{barber_id}/working-hours",
    response_model=Envelope[list[WorkingHoursPeriodOut]],
)
async def set_working_hours(
    shop_id: UUID,
    barber_id: UUID,
    payload: list[WorkingHoursPeriodIn],
    user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_rls_db),
) -> Envelope[list[WorkingHoursPeriodOut]]:
    """Full-week replace: the given periods become the barber's entire
    recurring schedule."""
    await _authorize_schedule_actor(db, user, shop_id, barber_id)

    for period in payload:
        if period.start_time >= period.end_time:
            raise BadRequestError(message="Each period's start_time must be before its end_time.")

    existing = await db.execute(
        select(BarberWorkingHours).where(BarberWorkingHours.barber_profile_id == barber_id)
    )
    for row in existing.scalars():
        await db.delete(row)
    await db.flush()

    for period in payload:
        db.add(BarberWorkingHours(barber_profile_id=barber_id, **period.model_dump()))
    await db.flush()

    hours_result = await db.execute(
        select(BarberWorkingHours)
        .where(BarberWorkingHours.barber_profile_id == barber_id)
        .order_by(BarberWorkingHours.day_of_week, BarberWorkingHours.start_time)
    )
    return envelope(
        [WorkingHoursPeriodOut.model_validate(h, from_attributes=True) for h in hours_result.scalars()]
    )


@router.post(
    "/shops/{shop_id}/barbers/{barber_id}/time-off", status_code=201, response_model=Envelope[TimeOffOut]
)
async def create_time_off(
    shop_id: UUID,
    barber_id: UUID,
    payload: TimeOffCreateIn,
    user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_rls_db),
) -> Envelope[TimeOffOut]:
    await _authorize_schedule_actor(db, user, shop_id, barber_id)
    if payload.start_at >= payload.end_at:
        raise BadRequestError(message="start_at must be before end_at.")

    time_off = BarberTimeOff(
        barber_profile_id=barber_id, start_at=payload.start_at, end_at=payload.end_at, reason=payload.reason
    )
    db.add(time_off)
    await db.flush()
    return envelope(TimeOffOut.model_validate(time_off, from_attributes=True))


@router.delete("/shops/{shop_id}/barbers/{barber_id}/time-off/{time_off_id}", status_code=204)
async def delete_time_off(
    shop_id: UUID,
    barber_id: UUID,
    time_off_id: UUID,
    user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_rls_db),
) -> None:
    await _authorize_schedule_actor(db, user, shop_id, barber_id)
    time_off = await db.get(BarberTimeOff, time_off_id)
    if time_off is None or time_off.barber_profile_id != barber_id:
        raise NotFoundError("Time-off record not found for this barber.")
    await db.delete(time_off)
    await db.flush()

from datetime import UTC, datetime, time, timedelta
from datetime import date as date_
from uuid import UUID
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, Query
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.appointments.models import Appointment, AppointmentDetails
from app.appointments.schemas import (
    AppointmentCompleteIn,
    AppointmentCreateIn,
    AppointmentDetailsOut,
    AppointmentOut,
    AppointmentRescheduleIn,
    RescheduleOut,
)
from app.appointments.service import create_appointment_transactionally
from app.auth.dependencies import get_current_user
from app.auth.schemas import AuthenticatedUser
from app.core.errors import AuthorizationError, ConflictError, NotFoundError
from app.core.responses import Envelope, envelope
from app.db.session import get_rls_db
from app.media.models import AppointmentMedia, MediaAsset
from app.permissions.roles import ROLE_PERMISSIONS, Permission, Role
from app.points.constants import COMPLETION_POINTS_REASON, DETAILED_COMPLETION_POINTS
from app.points.models import BarberPoint
from app.shops.models import Shop
from app.staff.models import BarberProfile, ShopMember

router = APIRouter(tags=["appointments"])


def _serialize(appointment: Appointment, details: AppointmentDetails | None = None) -> AppointmentOut:
    return AppointmentOut(
        id=appointment.id,
        shop_id=appointment.shop_id,
        barber_id=appointment.barber_profile_id,
        service_id=appointment.service_id,
        customer_user_id=appointment.customer_user_id,
        start_at=appointment.start_at,
        end_at=appointment.end_at,
        status=appointment.status,
        booking_note=appointment.booking_note,
        cancelled_at=appointment.cancelled_at,
        completed_at=appointment.completed_at,
        created_at=appointment.created_at,
        details=(
            AppointmentDetailsOut(
                actual_service_id=details.actual_service_id,
                final_price=details.final_price,
                notes=details.notes,
                completed_by_member_id=details.completed_by_member_id,
            )
            if details is not None
            else None
        ),
    )


async def _my_barber_profile_ids(db: AsyncSession, user_id: UUID) -> list[UUID]:
    result = await db.execute(
        select(BarberProfile.id)
        .join(ShopMember, ShopMember.id == BarberProfile.shop_member_id)
        .where(ShopMember.user_id == user_id, ShopMember.role == "barber", ShopMember.status == "active")
    )
    return [row for row in result.scalars()]


async def _my_managed_shop_ids(db: AsyncSession, user_id: UUID) -> list[UUID]:
    result = await db.execute(
        select(ShopMember.shop_id).where(
            ShopMember.user_id == user_id,
            ShopMember.role.in_(("owner", "manager")),
            ShopMember.status == "active",
        )
    )
    return [row for row in result.scalars()]


async def _visible_appointment_filter(db: AsyncSession, user: AuthenticatedUser):
    """What this user is authorized to see: their own bookings, appointments
    assigned to a barber profile they hold, or any appointment at a shop
    they own/manage.
    """
    barber_ids = await _my_barber_profile_ids(db, user.id)
    shop_ids = await _my_managed_shop_ids(db, user.id)
    clauses = [Appointment.customer_user_id == user.id]
    if barber_ids:
        clauses.append(Appointment.barber_profile_id.in_(barber_ids))
    if shop_ids:
        clauses.append(Appointment.shop_id.in_(shop_ids))
    return or_(*clauses)


async def _get_visible_appointment(
    db: AsyncSession, user: AuthenticatedUser, appointment_id: UUID
) -> Appointment:
    visible = await _visible_appointment_filter(db, user)
    result = await db.execute(select(Appointment).where(Appointment.id == appointment_id, visible))
    appointment = result.scalar_one_or_none()
    if appointment is None:
        # Never confirm an appointment exists to a caller who can't see it.
        raise NotFoundError("Appointment not found.")
    return appointment


async def _get_details(db: AsyncSession, appointment_id: UUID) -> AppointmentDetails | None:
    result = await db.execute(
        select(AppointmentDetails).where(AppointmentDetails.appointment_id == appointment_id)
    )
    return result.scalar_one_or_none()


async def _membership_for_shop(db: AsyncSession, user_id: UUID, shop_id: UUID) -> ShopMember | None:
    result = await db.execute(
        select(ShopMember).where(
            ShopMember.shop_id == shop_id, ShopMember.user_id == user_id, ShopMember.status == "active"
        )
    )
    return result.scalar_one_or_none()


async def _can_manage_appointment(
    db: AsyncSession, user: AuthenticatedUser, appointment: Appointment, permission: Permission
) -> bool:
    membership = await _membership_for_shop(db, user.id, appointment.shop_id)
    if membership is None or permission not in ROLE_PERMISSIONS.get(Role(membership.role), set()):
        return False
    if Role(membership.role) in (Role.OWNER, Role.MANAGER):
        return True
    # A barber may only act on appointments assigned to their own profile.
    barber_result = await db.execute(
        select(BarberProfile.id).where(BarberProfile.shop_member_id == membership.id)
    )
    barber_id = barber_result.scalar_one_or_none()
    return barber_id is not None and barber_id == appointment.barber_profile_id


@router.post("/appointments", status_code=201, response_model=Envelope[AppointmentOut])
async def create_appointment(
    payload: AppointmentCreateIn,
    user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_rls_db),
) -> Envelope[AppointmentOut]:
    appointment = await create_appointment_transactionally(
        db,
        customer_user_id=user.id,
        shop_id=payload.shop_id,
        barber_id=payload.barber_id,
        service_id=payload.service_id,
        start_at=payload.start_at,
        booking_note=payload.booking_note,
    )
    for media_id in payload.reference_media_ids:
        media = await db.get(MediaAsset, media_id)
        if media is not None and media.uploaded_by_user_id == user.id:
            db.add(
                AppointmentMedia(
                    appointment_id=appointment.id, media_asset_id=media_id, media_type="customer_reference"
                )
            )
    await db.flush()
    return envelope(_serialize(appointment))


@router.get("/appointments", response_model=Envelope[list[AppointmentOut]])
async def list_appointments(
    shop_id: UUID | None = Query(default=None),
    date: date_ | None = Query(default=None),
    status: str | None = Query(default=None),
    user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_rls_db),
) -> Envelope[list[AppointmentOut]]:
    visible = await _visible_appointment_filter(db, user)
    query = select(Appointment).where(visible)
    if shop_id is not None:
        query = query.where(Appointment.shop_id == shop_id)
    if status is not None:
        query = query.where(Appointment.status == status)
    if date is not None:
        # Interpret the date in the shop's own timezone when we know which
        # shop; otherwise (a cross-shop query) fall back to UTC calendar days.
        tz = UTC
        if shop_id is not None:
            shop = await db.get(Shop, shop_id)
            if shop is not None:
                tz = ZoneInfo(shop.timezone)
        day_start = datetime.combine(date, time.min, tzinfo=tz).astimezone(UTC)
        day_end = datetime.combine(date, time.max, tzinfo=tz).astimezone(UTC) + timedelta(microseconds=1)
        query = query.where(Appointment.start_at >= day_start, Appointment.start_at < day_end)
    query = query.order_by(Appointment.start_at.asc())
    result = await db.execute(query)
    return envelope([_serialize(a) for a in result.scalars()])


@router.get("/appointments/{appointment_id}", response_model=Envelope[AppointmentOut])
async def get_appointment(
    appointment_id: UUID,
    user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_rls_db),
) -> Envelope[AppointmentOut]:
    appointment = await _get_visible_appointment(db, user, appointment_id)
    details = await _get_details(db, appointment_id)
    return envelope(_serialize(appointment, details))


@router.post("/appointments/{appointment_id}/cancel", response_model=Envelope[AppointmentOut])
async def cancel_appointment(
    appointment_id: UUID,
    user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_rls_db),
) -> Envelope[AppointmentOut]:
    appointment = await _get_visible_appointment(db, user, appointment_id)
    is_owner = appointment.customer_user_id == user.id
    is_staff = await _can_manage_appointment(db, user, appointment, Permission.APPOINTMENTS_UPDATE)
    if not (is_owner or is_staff):
        raise AuthorizationError()
    if appointment.status != "booked":
        raise ConflictError(
            code="INVALID_APPOINTMENT_STATE", message="Only a booked appointment can be cancelled."
        )

    appointment.status = "cancelled"
    appointment.cancelled_at = datetime.now(UTC)
    await db.flush()
    return envelope(_serialize(appointment))


@router.post("/appointments/{appointment_id}/reschedule", response_model=Envelope[RescheduleOut])
async def reschedule_appointment(
    appointment_id: UUID,
    payload: AppointmentRescheduleIn,
    user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_rls_db),
) -> Envelope[RescheduleOut]:
    appointment = await _get_visible_appointment(db, user, appointment_id)
    is_owner = appointment.customer_user_id == user.id
    is_staff = await _can_manage_appointment(db, user, appointment, Permission.APPOINTMENTS_UPDATE)
    if not (is_owner or is_staff):
        raise AuthorizationError()
    if appointment.status != "booked":
        raise ConflictError(
            code="INVALID_APPOINTMENT_STATE", message="Only a booked appointment can be rescheduled."
        )

    # Cancel first so the exclusion constraint never spuriously conflicts
    # with the slot being vacated, then create the replacement in the same
    # request transaction — if this fails, the whole transaction (including
    # the cancellation) rolls back via get_db's exception handling, so the
    # reschedule is all-or-nothing without any manual undo logic here.
    old_id = appointment.id
    appointment.status = "cancelled"
    appointment.cancelled_at = datetime.now(UTC)
    await db.flush()

    new_appointment = await create_appointment_transactionally(
        db,
        customer_user_id=appointment.customer_user_id,
        shop_id=appointment.shop_id,
        barber_id=payload.barber_id or appointment.barber_profile_id,
        service_id=payload.service_id or appointment.service_id,
        start_at=payload.start_at,
        booking_note=appointment.booking_note,
    )

    return envelope(RescheduleOut(old_appointment_id=old_id, appointment=_serialize(new_appointment)))


@router.post("/appointments/{appointment_id}/complete", response_model=Envelope[AppointmentOut])
async def complete_appointment(
    appointment_id: UUID,
    payload: AppointmentCompleteIn,
    user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_rls_db),
) -> Envelope[AppointmentOut]:
    appointment = await _get_visible_appointment(db, user, appointment_id)
    if not await _can_manage_appointment(db, user, appointment, Permission.APPOINTMENTS_COMPLETE):
        raise AuthorizationError()
    if appointment.status != "booked":
        raise ConflictError(
            code="INVALID_APPOINTMENT_STATE", message="Only a booked appointment can be completed."
        )

    membership = await _membership_for_shop(db, user.id, appointment.shop_id)
    assert membership is not None

    existing_details = await _get_details(db, appointment_id)
    if existing_details is None:
        details = AppointmentDetails(
            appointment_id=appointment_id,
            actual_service_id=payload.actual_service_id,
            final_price=payload.final_price,
            notes=payload.notes,
            completed_by_member_id=membership.id,
        )
        db.add(details)
    else:
        details = existing_details
        details.actual_service_id = payload.actual_service_id
        details.final_price = payload.final_price
        details.notes = payload.notes
        details.completed_by_member_id = membership.id

    appointment.status = "completed"
    appointment.completed_at = datetime.now(UTC)

    if payload.finished_cut_media_id is not None:
        media = await db.get(MediaAsset, payload.finished_cut_media_id)
        if media is not None:
            db.add(
                AppointmentMedia(
                    appointment_id=appointment.id,
                    media_asset_id=payload.finished_cut_media_id,
                    media_type="finished_cut",
                )
            )

    # Idempotent: unique(appointment_id, reason) means a retry can't award
    # points twice even under a race, but check first to avoid a noisy
    # constraint-violation round trip on the common retry path.
    existing_points = await db.execute(
        select(BarberPoint).where(
            BarberPoint.appointment_id == appointment_id, BarberPoint.reason == COMPLETION_POINTS_REASON
        )
    )
    if existing_points.scalar_one_or_none() is None:
        db.add(
            BarberPoint(
                barber_profile_id=appointment.barber_profile_id,
                appointment_id=appointment_id,
                points=DETAILED_COMPLETION_POINTS,
                reason=COMPLETION_POINTS_REASON,
            )
        )

    await db.flush()
    return envelope(_serialize(appointment, details))


@router.post("/appointments/{appointment_id}/skip-completion", response_model=Envelope[AppointmentOut])
async def skip_completion(
    appointment_id: UUID,
    user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_rls_db),
) -> Envelope[AppointmentOut]:
    appointment = await _get_visible_appointment(db, user, appointment_id)
    if not await _can_manage_appointment(db, user, appointment, Permission.APPOINTMENTS_COMPLETE):
        raise AuthorizationError()
    if appointment.status != "booked":
        raise ConflictError(
            code="INVALID_APPOINTMENT_STATE", message="Only a booked appointment can be closed."
        )

    appointment.status = "completed"
    appointment.completed_at = datetime.now(UTC)
    await db.flush()
    return envelope(_serialize(appointment))


@router.post("/appointments/{appointment_id}/no-show", response_model=Envelope[AppointmentOut])
async def mark_no_show(
    appointment_id: UUID,
    user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_rls_db),
) -> Envelope[AppointmentOut]:
    appointment = await _get_visible_appointment(db, user, appointment_id)
    if not await _can_manage_appointment(db, user, appointment, Permission.APPOINTMENTS_COMPLETE):
        raise AuthorizationError()
    if appointment.status != "booked":
        raise ConflictError(
            code="INVALID_APPOINTMENT_STATE", message="Only a booked appointment can be marked no-show."
        )

    appointment.status = "no_show"
    await db.flush()
    return envelope(_serialize(appointment))

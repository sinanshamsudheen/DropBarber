from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.appointments.models import Appointment, AppointmentDetails
from app.auth.dependencies import get_current_user
from app.auth.schemas import AuthenticatedUser
from app.core.errors import NotFoundError
from app.core.pagination import PageParams, page_params
from app.core.responses import Envelope, Page, Pagination, envelope
from app.customers.models import ShopCustomer
from app.customers.schemas import (
    CustomerHistoryItem,
    ShopAppointmentHistoryItem,
    ShopCustomerDetailOut,
    ShopCustomerSummaryOut,
    ShopCustomerUpdateIn,
    ShopCustomerUpdateOut,
)
from app.db.session import get_rls_db
from app.media.models import AppointmentMedia
from app.permissions.dependencies import require_shop_permission
from app.permissions.roles import Permission
from app.shops.models import Shop
from app.staff.models import ShopMember
from app.users.models import User

router = APIRouter(tags=["customers"])


async def _visit_stats(
    db: AsyncSession, shop_id: UUID, customer_user_id: UUID
) -> tuple[int, datetime | None]:
    result = await db.execute(
        select(func.count(), func.max(Appointment.start_at)).where(
            Appointment.shop_id == shop_id,
            Appointment.customer_user_id == customer_user_id,
            Appointment.status == "completed",
        )
    )
    count, last_visit = result.one()
    return count or 0, last_visit


@router.get("/shops/{shop_id}/customers", response_model=Page[ShopCustomerSummaryOut])
async def list_shop_customers(
    shop_id: UUID,
    q: str | None = Query(default=None, max_length=200),
    page_params: PageParams = Depends(page_params),
    db: AsyncSession = Depends(get_rls_db),
    _membership: ShopMember = Depends(require_shop_permission(Permission.CUSTOMERS_READ)),
) -> Page[ShopCustomerSummaryOut]:
    query = (
        select(ShopCustomer, User)
        .join(User, User.id == ShopCustomer.customer_user_id)
        .where(ShopCustomer.shop_id == shop_id)
    )
    if q:
        query = query.where((User.display_name.ilike(f"%{q}%")) | (User.email.ilike(f"%{q}%")))

    count_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = count_result.scalar_one()

    query = query.order_by(User.display_name).limit(page_params.page_size).offset(page_params.offset)
    result = await db.execute(query)

    data = []
    for shop_customer, user in result.all():
        visits, last_visit = await _visit_stats(db, shop_id, user.id)
        data.append(
            ShopCustomerSummaryOut(
                customer_user_id=user.id,
                display_name=user.display_name,
                email=user.email,
                phone=user.phone,
                visits=visits,
                last_visit=last_visit,
                preferred_barber_id=shop_customer.preferred_barber_id,
            )
        )
    return Page[ShopCustomerSummaryOut](
        data=data,
        pagination=Pagination(page=page_params.page, page_size=page_params.page_size, total=total),
    )


async def _get_shop_customer_or_404(db: AsyncSession, shop_id: UUID, customer_user_id: UUID) -> ShopCustomer:
    result = await db.execute(
        select(ShopCustomer).where(
            ShopCustomer.shop_id == shop_id, ShopCustomer.customer_user_id == customer_user_id
        )
    )
    shop_customer = result.scalar_one_or_none()
    if shop_customer is None:
        raise NotFoundError("This customer has no relationship with this shop.")
    return shop_customer


@router.get("/shops/{shop_id}/customers/{customer_id}", response_model=Envelope[ShopCustomerDetailOut])
async def get_shop_customer(
    shop_id: UUID,
    customer_id: UUID,
    db: AsyncSession = Depends(get_rls_db),
    _membership: ShopMember = Depends(require_shop_permission(Permission.CUSTOMERS_READ)),
) -> Envelope[ShopCustomerDetailOut]:
    shop_customer = await _get_shop_customer_or_404(db, shop_id, customer_id)
    user = await db.get(User, customer_id)
    visits, last_visit = await _visit_stats(db, shop_id, customer_id)

    appointments_result = await db.execute(
        select(Appointment, AppointmentDetails.final_price)
        .outerjoin(AppointmentDetails, AppointmentDetails.appointment_id == Appointment.id)
        .where(Appointment.shop_id == shop_id, Appointment.customer_user_id == customer_id)
        .order_by(Appointment.start_at.desc())
    )
    appointments = [
        ShopAppointmentHistoryItem(
            id=a.id,
            barber_id=a.barber_profile_id,
            service_id=a.service_id,
            start_at=a.start_at,
            status=a.status,
            final_price=final_price,
        )
        for a, final_price in appointments_result.all()
    ]

    media_result = await db.execute(
        select(AppointmentMedia.media_asset_id)
        .join(Appointment, Appointment.id == AppointmentMedia.appointment_id)
        .where(
            Appointment.shop_id == shop_id,
            Appointment.customer_user_id == customer_id,
            AppointmentMedia.media_type == "customer_reference",
        )
    )
    reference_media_ids = list(media_result.scalars())

    return envelope(
        ShopCustomerDetailOut(
            customer_user_id=customer_id,
            display_name=user.display_name if user else None,
            email=user.email if user else None,
            phone=user.phone if user else None,
            visits=visits,
            last_visit=last_visit,
            preferred_barber_id=shop_customer.preferred_barber_id,
            notes=shop_customer.notes,
            appointments=appointments,
            reference_media_ids=reference_media_ids,
        )
    )


@router.patch("/shops/{shop_id}/customers/{customer_id}", response_model=Envelope[ShopCustomerUpdateOut])
async def update_shop_customer(
    shop_id: UUID,
    customer_id: UUID,
    payload: ShopCustomerUpdateIn,
    db: AsyncSession = Depends(get_rls_db),
    _membership: ShopMember = Depends(require_shop_permission(Permission.CUSTOMERS_UPDATE)),
) -> Envelope[ShopCustomerUpdateOut]:
    shop_customer = await _get_shop_customer_or_404(db, shop_id, customer_id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(shop_customer, field, value)
    await db.flush()
    return envelope(
        ShopCustomerUpdateOut(
            customer_user_id=customer_id,
            notes=shop_customer.notes,
            preferred_barber_id=shop_customer.preferred_barber_id,
        )
    )


@router.get("/me/history", response_model=Envelope[list[CustomerHistoryItem]])
async def get_my_history(
    user: AuthenticatedUser = Depends(get_current_user), db: AsyncSession = Depends(get_rls_db)
) -> Envelope[list[CustomerHistoryItem]]:
    """The customer's own cross-shop history. Identity comes only from the
    verified JWT — no customer_id is ever accepted here.
    """
    result = await db.execute(
        select(Appointment, Shop.name, AppointmentDetails.final_price)
        .join(Shop, Shop.id == Appointment.shop_id)
        .outerjoin(AppointmentDetails, AppointmentDetails.appointment_id == Appointment.id)
        .where(Appointment.customer_user_id == user.id, Appointment.status != "booked")
        .order_by(Appointment.start_at.desc())
    )
    return envelope(
        [
            CustomerHistoryItem(
                appointment_id=a.id,
                shop_id=a.shop_id,
                shop_name=shop_name,
                barber_id=a.barber_profile_id,
                service_id=a.service_id,
                start_at=a.start_at,
                status=a.status,
                final_price=final_price,
            )
            for a, shop_name, final_price in result.all()
        ]
    )

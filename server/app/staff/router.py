from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.auth.schemas import AuthenticatedUser
from app.core.errors import AuthorizationError, ConflictError, NotFoundError
from app.core.responses import Envelope, StatusOut, envelope
from app.db.session import get_rls_db
from app.permissions.dependencies import get_shop_membership, require_shop_permission
from app.permissions.roles import Permission
from app.staff.models import BarberProfile, ShopMember
from app.staff.schemas import (
    BarberCreateIn,
    BarberLookupOut,
    BarberManageOut,
    BarberUpdateIn,
    ShopMemberOut,
)
from app.users.models import User

router = APIRouter(tags=["staff"])


def _to_barber_manage_out(barber: BarberProfile, user_id: UUID) -> BarberManageOut:
    return BarberManageOut(
        id=barber.id,
        shop_member_id=barber.shop_member_id,
        user_id=user_id,
        display_name=barber.display_name,
        bio=barber.bio,
        profile_image_url=barber.profile_image_url,
        status=barber.status,
    )


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


@router.get("/shops/{shop_id}/members", response_model=Envelope[list[ShopMemberOut]])
async def list_shop_members(
    shop_id: UUID,
    db: AsyncSession = Depends(get_rls_db),
    _membership: ShopMember = Depends(require_shop_permission(Permission.STAFF_READ)),
) -> Envelope[list[ShopMemberOut]]:
    result = await db.execute(
        select(ShopMember).where(ShopMember.shop_id == shop_id).order_by(ShopMember.created_at)
    )
    return envelope([ShopMemberOut.model_validate(m, from_attributes=True) for m in result.scalars()])


@router.post("/shops/{shop_id}/barbers", status_code=201, response_model=Envelope[BarberManageOut])
async def create_barber(
    shop_id: UUID,
    payload: BarberCreateIn,
    db: AsyncSession = Depends(get_rls_db),
    _membership: ShopMember = Depends(require_shop_permission(Permission.STAFF_CREATE)),
) -> Envelope[BarberManageOut]:
    member = ShopMember(shop_id=shop_id, user_id=payload.user_id, role="barber", status="active")
    db.add(member)
    await db.flush()

    barber = BarberProfile(
        shop_member_id=member.id,
        display_name=payload.display_name,
        bio=payload.bio,
        profile_image_url=payload.profile_image_url,
        status="active",
    )
    db.add(barber)
    await db.flush()

    return envelope(_to_barber_manage_out(barber, payload.user_id))


@router.get("/shops/{shop_id}/barbers/lookup", response_model=Envelope[BarberLookupOut])
async def lookup_barber_candidate(
    shop_id: UUID,
    email: str = Query(..., min_length=3, max_length=320),
    db: AsyncSession = Depends(get_rls_db),
    _membership: ShopMember = Depends(require_shop_permission(Permission.STAFF_CREATE)),
) -> Envelope[BarberLookupOut]:
    result = await db.execute(select(User).where(func.lower(User.email) == email.strip().lower()))
    user = result.scalar_one_or_none()
    if user is None:
        raise NotFoundError("No account found with that email.")

    existing = await db.execute(
        select(ShopMember).where(
            ShopMember.shop_id == shop_id,
            ShopMember.user_id == user.id,
            ShopMember.status == "active",
        )
    )
    if existing.scalar_one_or_none() is not None:
        raise ConflictError("That user is already an active member of this shop.")

    return envelope(
        BarberLookupOut(user_id=user.id, email=user.email or email, display_name=user.display_name)
    )


@router.get("/shops/{shop_id}/barbers/{barber_id}", response_model=Envelope[BarberManageOut])
async def get_managed_barber(
    shop_id: UUID,
    barber_id: UUID,
    user: AuthenticatedUser = Depends(get_current_user),
    membership: ShopMember | None = Depends(get_shop_membership),
    db: AsyncSession = Depends(get_rls_db),
) -> Envelope[BarberManageOut]:
    barber, member = await _get_barber_or_404(db, shop_id, barber_id)
    is_self = member.user_id == user.id
    is_staff_reader = membership is not None and membership.role in ("owner", "manager")
    if not (is_self or is_staff_reader):
        raise AuthorizationError()
    return envelope(_to_barber_manage_out(barber, member.user_id))


@router.patch("/shops/{shop_id}/barbers/{barber_id}", response_model=Envelope[BarberManageOut])
async def update_barber(
    shop_id: UUID,
    barber_id: UUID,
    payload: BarberUpdateIn,
    user: AuthenticatedUser = Depends(get_current_user),
    membership: ShopMember | None = Depends(get_shop_membership),
    db: AsyncSession = Depends(get_rls_db),
) -> Envelope[BarberManageOut]:
    barber, member = await _get_barber_or_404(db, shop_id, barber_id)
    is_self = member.user_id == user.id
    is_staff_writer = membership is not None and membership.role in ("owner", "manager")
    if not (is_self or is_staff_writer):
        raise AuthorizationError()

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(barber, field, value)
    await db.flush()
    return envelope(_to_barber_manage_out(barber, member.user_id))


@router.post("/shops/{shop_id}/barbers/{barber_id}/deactivate", response_model=Envelope[StatusOut])
async def deactivate_barber(
    shop_id: UUID,
    barber_id: UUID,
    db: AsyncSession = Depends(get_rls_db),
    _membership: ShopMember = Depends(require_shop_permission(Permission.STAFF_MANAGE)),
) -> Envelope[StatusOut]:
    barber, _member = await _get_barber_or_404(db, shop_id, barber_id)
    barber.status = "inactive"
    await db.flush()
    return envelope(StatusOut(id=barber.id, status=barber.status))


@router.post("/shops/{shop_id}/barbers/{barber_id}/remove", response_model=Envelope[StatusOut])
async def remove_barber(
    shop_id: UUID,
    barber_id: UUID,
    db: AsyncSession = Depends(get_rls_db),
    _membership: ShopMember = Depends(require_shop_permission(Permission.STAFF_MANAGE)),
) -> Envelope[StatusOut]:
    barber, member = await _get_barber_or_404(db, shop_id, barber_id)
    barber.status = "inactive"
    member.status = "inactive"
    await db.flush()
    return envelope(StatusOut(id=barber.id, status=barber.status))

from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.auth.schemas import AuthenticatedUser
from app.core.errors import AuthorizationError, NotFoundError
from app.core.responses import Envelope, envelope
from app.db.session import get_rls_db
from app.permissions.dependencies import get_shop_membership
from app.points.models import BarberPoint
from app.points.schemas import BarberPointsOut, PointEntryOut, ShopBarberPointsSummary
from app.staff.models import BarberProfile, ShopMember

router = APIRouter(tags=["points"])


@router.get("/shops/{shop_id}/barbers/{barber_id}/points", response_model=Envelope[BarberPointsOut])
async def get_barber_points(
    shop_id: UUID,
    barber_id: UUID,
    user: AuthenticatedUser = Depends(get_current_user),
    membership: ShopMember | None = Depends(get_shop_membership),
    db: AsyncSession = Depends(get_rls_db),
) -> Envelope[BarberPointsOut]:
    barber_result = await db.execute(
        select(BarberProfile, ShopMember)
        .join(ShopMember, ShopMember.id == BarberProfile.shop_member_id)
        .where(BarberProfile.id == barber_id, ShopMember.shop_id == shop_id)
    )
    row = barber_result.first()
    if row is None:
        raise NotFoundError("Barber not found for this shop.")
    _barber, member = row

    is_self = member.user_id == user.id
    is_staff_reader = membership is not None and membership.role in ("owner", "manager")
    if not (is_self or is_staff_reader):
        raise AuthorizationError()

    result = await db.execute(
        select(BarberPoint)
        .where(BarberPoint.barber_profile_id == barber_id)
        .order_by(BarberPoint.created_at.desc())
    )
    entries = list(result.scalars())
    return envelope(
        BarberPointsOut(
            barber_id=barber_id,
            total_points=sum(e.points for e in entries),
            history=[PointEntryOut.model_validate(e, from_attributes=True) for e in entries],
        )
    )


@router.get("/shops/{shop_id}/points", response_model=Envelope[list[ShopBarberPointsSummary]])
async def get_shop_points_summary(
    shop_id: UUID,
    db: AsyncSession = Depends(get_rls_db),
    membership: ShopMember | None = Depends(get_shop_membership),
) -> Envelope[list[ShopBarberPointsSummary]]:
    if membership is None or membership.role not in ("owner", "manager"):
        raise AuthorizationError()

    result = await db.execute(
        select(BarberProfile, func.coalesce(func.sum(BarberPoint.points), 0))
        .join(ShopMember, ShopMember.id == BarberProfile.shop_member_id)
        .outerjoin(BarberPoint, BarberPoint.barber_profile_id == BarberProfile.id)
        .where(ShopMember.shop_id == shop_id)
        .group_by(BarberProfile.id)
        .order_by(BarberProfile.display_name)
    )
    return envelope(
        [
            ShopBarberPointsSummary(barber_id=barber.id, display_name=barber.display_name, total_points=total)
            for barber, total in result.all()
        ]
    )

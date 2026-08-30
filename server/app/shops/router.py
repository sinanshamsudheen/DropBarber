from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from geoalchemy2.functions import ST_Distance, ST_DWithin, ST_MakePoint, ST_SetSRID
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.auth.schemas import AuthenticatedUser
from app.core.config import Settings, get_settings
from app.core.errors import NotFoundError
from app.core.pagination import PageParams, page_params
from app.core.responses import Envelope, Page, Pagination, envelope
from app.db.session import get_rls_db
from app.permissions.dependencies import require_shop_permission
from app.permissions.roles import Permission
from app.reviews.models import Review
from app.services.models import Service
from app.shops.models import Shop
from app.shops.schemas import (
    BarberDetailOut,
    BarberPublicOut,
    MyShopOut,
    ServicePublicOut,
    ShopCreateIn,
    ShopCreateOut,
    ShopPublicOut,
    ShopUpdateIn,
)
from app.shops.service import build_barber_public_out, build_shop_public_out
from app.staff.models import BarberProfile, ShopMember

router = APIRouter(tags=["shops"])

MAX_RADIUS_KM = 200
DEFAULT_RADIUS_KM = 25


@router.get("/shops", response_model=Page[ShopPublicOut])
async def list_shops(
    latitude: Decimal | None = Query(default=None, ge=-90, le=90),
    longitude: Decimal | None = Query(default=None, ge=-180, le=180),
    radius_km: float = Query(default=DEFAULT_RADIUS_KM, gt=0, le=MAX_RADIUS_KM),
    min_rating: float | None = Query(default=None, ge=0, le=5),
    service: str | None = Query(default=None, max_length=200),
    page_params: PageParams = Depends(page_params),
    settings: Settings = Depends(get_settings),
    db: AsyncSession = Depends(get_rls_db),
) -> Page[ShopPublicOut]:
    """Public shop discovery. Only active shops, and only public fields."""
    filters = [Shop.status == "active"]
    distance_expr = None

    if latitude is not None and longitude is not None:
        point = ST_SetSRID(ST_MakePoint(float(longitude), float(latitude)), 4326)
        distance_expr = ST_Distance(Shop.location, point)
        filters.append(ST_DWithin(Shop.location, point, radius_km * 1000))

    if service:
        filters.append(
            Shop.id.in_(
                select(Service.shop_id).where(Service.name.ilike(f"%{service}%"), Service.status == "active")
            )
        )

    if min_rating is not None:
        avg_rating_subq = select(func.avg(Review.rating)).where(Review.shop_id == Shop.id).scalar_subquery()
        filters.append(func.coalesce(avg_rating_subq, 0) >= min_rating)

    count_result = await db.execute(select(func.count()).select_from(select(Shop).where(*filters).subquery()))
    total = count_result.scalar_one()

    columns = (Shop, distance_expr) if distance_expr is not None else (Shop,)
    query = select(*columns).where(*filters)
    query = query.order_by(distance_expr.asc() if distance_expr is not None else Shop.name.asc())
    query = query.limit(page_params.page_size).offset(page_params.offset)

    result = await db.execute(query)
    rows = [(row, None) for row in result.scalars()] if distance_expr is None else list(result.all())

    shops_out: list[ShopPublicOut] = [
        await build_shop_public_out(
            db, shop, settings, distance_km=(float(distance_m) / 1000 if distance_m is not None else None)
        )
        for shop, distance_m in rows
    ]

    return Page[ShopPublicOut](
        data=shops_out,
        pagination=Pagination(page=page_params.page, page_size=page_params.page_size, total=total),
    )


@router.get("/shops/{shop_id}", response_model=Envelope[ShopPublicOut])
async def get_shop(
    shop_id: UUID,
    settings: Settings = Depends(get_settings),
    db: AsyncSession = Depends(get_rls_db),
) -> Envelope[ShopPublicOut]:
    shop = await db.get(Shop, shop_id)
    if shop is None or shop.status != "active":
        raise NotFoundError("That shop doesn't exist or is no longer listed.")
    return envelope(await build_shop_public_out(db, shop, settings))


@router.get("/shops/{shop_id}/services", response_model=Envelope[list[ServicePublicOut]])
async def list_shop_services(
    shop_id: UUID, db: AsyncSession = Depends(get_rls_db)
) -> Envelope[list[ServicePublicOut]]:
    result = await db.execute(
        select(Service).where(Service.shop_id == shop_id, Service.status == "active").order_by(Service.name)
    )
    return envelope([ServicePublicOut.model_validate(s, from_attributes=True) for s in result.scalars()])


@router.get("/shops/{shop_id}/barbers", response_model=Envelope[list[BarberPublicOut]])
async def list_shop_barbers(
    shop_id: UUID, db: AsyncSession = Depends(get_rls_db)
) -> Envelope[list[BarberPublicOut]]:
    result = await db.execute(
        select(BarberProfile)
        .join(ShopMember, ShopMember.id == BarberProfile.shop_member_id)
        .where(ShopMember.shop_id == shop_id, BarberProfile.status == "active")
        .order_by(BarberProfile.display_name)
    )
    barbers: list[BarberPublicOut] = [
        await build_barber_public_out(db, barber, shop_id) for barber in result.scalars()
    ]
    return envelope(barbers)


@router.get("/barbers/{barber_id}", response_model=Envelope[BarberDetailOut])
async def get_barber(
    barber_id: UUID,
    settings: Settings = Depends(get_settings),
    db: AsyncSession = Depends(get_rls_db),
) -> Envelope[BarberDetailOut]:
    """Public standalone barber profile, independent of which shop route the
    frontend navigated through."""
    result = await db.execute(
        select(BarberProfile, ShopMember.shop_id)
        .join(ShopMember, ShopMember.id == BarberProfile.shop_member_id)
        .where(BarberProfile.id == barber_id, BarberProfile.status == "active")
    )
    row = result.first()
    if row is None:
        raise NotFoundError("Barber not found.")
    barber, shop_id = row

    shop = await db.get(Shop, shop_id)
    if shop is None or shop.status != "active":
        raise NotFoundError("Barber not found.")

    return envelope(
        BarberDetailOut(
            barber=await build_barber_public_out(db, barber, shop_id),
            shop=await build_shop_public_out(db, shop, settings),
        )
    )


@router.post("/shops", status_code=201, response_model=Envelope[ShopCreateOut])
async def create_shop(
    payload: ShopCreateIn,
    user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_rls_db),
) -> Envelope[ShopCreateOut]:
    """Any logged-in user may create a shop and becomes its initial owner —
    the corresponding shop_members bootstrap RLS policy from Phase 2 is what
    makes this legal (the very first member of a shop may insert themselves
    as owner).
    """
    shop = Shop(**payload.model_dump(), status="active")
    db.add(shop)
    await db.flush()

    member = ShopMember(shop_id=shop.id, user_id=user.id, role="owner", status="active")
    db.add(member)
    await db.flush()

    return envelope(ShopCreateOut(id=shop.id, name=shop.name, status=shop.status))


@router.get("/my/shops", response_model=Envelope[list[MyShopOut]])
async def list_my_shops(
    user: AuthenticatedUser = Depends(get_current_user), db: AsyncSession = Depends(get_rls_db)
) -> Envelope[list[MyShopOut]]:
    result = await db.execute(
        select(Shop, ShopMember.role, ShopMember.status)
        .join(ShopMember, ShopMember.shop_id == Shop.id)
        .where(ShopMember.user_id == user.id, ShopMember.status == "active")
        .order_by(Shop.name)
    )
    return envelope(
        [
            MyShopOut(id=shop.id, name=shop.name, role=role, status=status)
            for shop, role, status in result.all()
        ]
    )


@router.patch("/shops/{shop_id}", response_model=Envelope[ShopPublicOut])
async def update_shop(
    shop_id: UUID,
    payload: ShopUpdateIn,
    settings: Settings = Depends(get_settings),
    db: AsyncSession = Depends(get_rls_db),
    _membership: ShopMember = Depends(require_shop_permission(Permission.SHOP_UPDATE)),
) -> Envelope[ShopPublicOut]:
    shop = await db.get(Shop, shop_id)
    if shop is None:
        raise NotFoundError("Shop not found.")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(shop, field, value)
    await db.flush()
    return envelope(await build_shop_public_out(db, shop, settings))

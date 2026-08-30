from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import BadRequestError, NotFoundError
from app.core.responses import Envelope, StatusOut, envelope
from app.db.session import get_rls_db
from app.permissions.dependencies import require_shop_permission
from app.permissions.roles import Permission
from app.services.models import BarberService, Service
from app.services.schemas import (
    BarberServiceConfigIn,
    BarberServiceConfigOut,
    ServiceCreateIn,
    ServiceManageOut,
    ServiceUpdateIn,
)
from app.staff.models import BarberProfile, ShopMember

router = APIRouter(tags=["services"])


@router.post("/shops/{shop_id}/services", status_code=201, response_model=Envelope[ServiceManageOut])
async def create_service(
    shop_id: UUID,
    payload: ServiceCreateIn,
    db: AsyncSession = Depends(get_rls_db),
    _membership=Depends(require_shop_permission(Permission.SERVICES_CREATE)),
) -> Envelope[ServiceManageOut]:
    service = Service(shop_id=shop_id, status="active", **payload.model_dump())
    db.add(service)
    await db.flush()
    return envelope(ServiceManageOut.model_validate(service, from_attributes=True))


@router.get("/shops/{shop_id}/services/manage", response_model=Envelope[list[ServiceManageOut]])
async def list_services_manage(
    shop_id: UUID,
    db: AsyncSession = Depends(get_rls_db),
    _membership=Depends(require_shop_permission(Permission.SERVICES_READ)),
) -> Envelope[list[ServiceManageOut]]:
    result = await db.execute(select(Service).where(Service.shop_id == shop_id).order_by(Service.name))
    return envelope([ServiceManageOut.model_validate(s, from_attributes=True) for s in result.scalars()])


@router.patch("/shops/{shop_id}/services/{service_id}", response_model=Envelope[ServiceManageOut])
async def update_service(
    shop_id: UUID,
    service_id: UUID,
    payload: ServiceUpdateIn,
    db: AsyncSession = Depends(get_rls_db),
    _membership=Depends(require_shop_permission(Permission.SERVICES_UPDATE)),
) -> Envelope[ServiceManageOut]:
    service = await db.get(Service, service_id)
    if service is None or service.shop_id != shop_id:
        raise NotFoundError("Service not found for this shop.")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(service, field, value)
    await db.flush()
    return envelope(ServiceManageOut.model_validate(service, from_attributes=True))


@router.post("/shops/{shop_id}/services/{service_id}/deactivate", response_model=Envelope[StatusOut])
async def deactivate_service(
    shop_id: UUID,
    service_id: UUID,
    db: AsyncSession = Depends(get_rls_db),
    _membership=Depends(require_shop_permission(Permission.SERVICES_MANAGE)),
) -> Envelope[StatusOut]:
    service = await db.get(Service, service_id)
    if service is None or service.shop_id != shop_id:
        raise NotFoundError("Service not found for this shop.")
    service.status = "inactive"
    await db.flush()
    return envelope(StatusOut(id=service.id, status=service.status))


@router.put(
    "/shops/{shop_id}/barbers/{barber_id}/services/{service_id}",
    response_model=Envelope[BarberServiceConfigOut],
)
async def set_barber_service(
    shop_id: UUID,
    barber_id: UUID,
    service_id: UUID,
    payload: BarberServiceConfigIn,
    db: AsyncSession = Depends(get_rls_db),
    _membership=Depends(require_shop_permission(Permission.SERVICES_MANAGE)),
) -> Envelope[BarberServiceConfigOut]:
    """Configures duration/price/active for one barber+service pair — the
    source of truth availability calculation reads from.
    """
    barber_result = await db.execute(
        select(BarberProfile)
        .join(ShopMember, ShopMember.id == BarberProfile.shop_member_id)
        .where(BarberProfile.id == barber_id, ShopMember.shop_id == shop_id)
    )
    if barber_result.scalar_one_or_none() is None:
        raise BadRequestError(code="INVALID_BARBER", message="Barber does not belong to this shop.")

    service = await db.get(Service, service_id)
    if service is None or service.shop_id != shop_id:
        raise BadRequestError(code="INVALID_SERVICE", message="Service does not belong to this shop.")

    stmt = (
        pg_insert(BarberService)
        .values(
            barber_profile_id=barber_id,
            service_id=service_id,
            duration_minutes=payload.duration_minutes,
            price_override=payload.price_override,
            is_active=payload.is_active,
        )
        .on_conflict_do_update(
            index_elements=["barber_profile_id", "service_id"],
            set_={
                "duration_minutes": payload.duration_minutes,
                "price_override": payload.price_override,
                "is_active": payload.is_active,
            },
        )
    )
    await db.execute(stmt)
    await db.flush()

    result = await db.execute(
        select(BarberService).where(
            BarberService.barber_profile_id == barber_id, BarberService.service_id == service_id
        )
    )
    barber_service = result.scalar_one()
    return envelope(BarberServiceConfigOut.model_validate(barber_service, from_attributes=True))

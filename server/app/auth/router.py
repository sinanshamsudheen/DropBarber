from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import gotrue
from app.auth.dependencies import get_bearer_token, get_current_user
from app.auth.schemas import (
    AuthenticatedUser,
    GoTrueSession,
    LoginIn,
    MembershipOut,
    MeOut,
    RefreshIn,
    RegisterIn,
    SessionOut,
)
from app.core.config import Settings, get_settings
from app.core.responses import Envelope, envelope
from app.db.session import get_rls_db
from app.shops.models import Shop
from app.staff.models import BarberProfile, ShopMember
from app.users.models import User

router = APIRouter(tags=["auth"])


def _session_out(session: GoTrueSession) -> SessionOut:
    return SessionOut(
        access_token=session.access_token,
        refresh_token=session.refresh_token,
        expires_at=session.expires_at,
        user_id=session.user.id,
        email=session.user.email,
    )


@router.post("/auth/register", status_code=201, response_model=Envelope[SessionOut])
async def register(payload: RegisterIn, settings: Settings = Depends(get_settings)) -> Envelope[SessionOut]:
    session = await gotrue.register(settings, payload.email, payload.password, payload.display_name)
    return envelope(_session_out(session))


@router.post("/auth/login", response_model=Envelope[SessionOut])
async def login(payload: LoginIn, settings: Settings = Depends(get_settings)) -> Envelope[SessionOut]:
    session = await gotrue.login(settings, payload.email, payload.password)
    return envelope(_session_out(session))


@router.post("/auth/refresh", response_model=Envelope[SessionOut])
async def refresh_token(
    payload: RefreshIn, settings: Settings = Depends(get_settings)
) -> Envelope[SessionOut]:
    session = await gotrue.refresh(settings, payload.refresh_token)
    return envelope(_session_out(session))


@router.post("/auth/logout", status_code=204)
async def logout(
    access_token: str = Depends(get_bearer_token), settings: Settings = Depends(get_settings)
) -> None:
    await gotrue.logout(settings, access_token)


@router.get("/auth/me", response_model=Envelope[MeOut])
async def get_me(
    user: AuthenticatedUser = Depends(get_current_user), db: AsyncSession = Depends(get_rls_db)
) -> Envelope[MeOut]:
    account = await db.get(User, user.id)

    result = await db.execute(
        select(ShopMember, Shop.name, BarberProfile.id)
        .join(Shop, Shop.id == ShopMember.shop_id)
        .outerjoin(BarberProfile, BarberProfile.shop_member_id == ShopMember.id)
        .where(ShopMember.user_id == user.id, ShopMember.status == "active")
    )
    memberships = [
        MembershipOut(shop_id=member.shop_id, shop_name=shop_name, role=member.role, barber_id=barber_id)
        for member, shop_name, barber_id in result.all()
    ]

    return envelope(
        MeOut(
            id=user.id,
            email=account.email if account else user.email,
            display_name=account.display_name if account else None,
            avatar_url=account.avatar_url if account else None,
            memberships=memberships,
        )
    )

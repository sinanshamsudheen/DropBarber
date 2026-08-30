import uuid
from collections.abc import Callable, Coroutine
from typing import Any

from fastapi import Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.auth.schemas import AuthenticatedUser
from app.core.errors import AuthorizationError
from app.db.session import get_rls_db
from app.permissions.roles import ROLE_PERMISSIONS, Permission, Role
from app.staff.models import ShopMember


async def get_shop_membership(
    shop_id: uuid.UUID,
    user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_rls_db),
) -> ShopMember | None:
    """Resolves the authenticated user's active membership for the shop named
    by the route's `{shop_id}` path parameter, or None if they aren't one.

    FastAPI matches this `shop_id` parameter to the route's own `shop_id`
    path parameter automatically since the names match.
    """
    result = await db.execute(
        select(ShopMember).where(
            ShopMember.shop_id == shop_id,
            ShopMember.user_id == user.id,
            ShopMember.status == "active",
        )
    )
    return result.scalar_one_or_none()


def require_shop_role(*allowed: Role) -> Callable[..., Coroutine[Any, Any, ShopMember]]:
    async def dependency(membership: ShopMember | None = Depends(get_shop_membership)) -> ShopMember:
        if membership is None or Role(membership.role) not in allowed:
            raise AuthorizationError()
        return membership

    return dependency


def require_shop_permission(permission: Permission) -> Callable[..., Coroutine[Any, Any, ShopMember]]:
    async def dependency(membership: ShopMember | None = Depends(get_shop_membership)) -> ShopMember:
        if membership is None or permission not in ROLE_PERMISSIONS.get(Role(membership.role), set()):
            raise AuthorizationError()
        return membership

    return dependency

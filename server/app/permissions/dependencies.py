from collections.abc import Callable, Coroutine
from typing import Any

from fastapi import Depends

from app.auth.dependencies import get_current_user
from app.auth.schemas import AuthenticatedUser
from app.core.errors import AuthorizationError
from app.permissions.roles import ROLE_PERMISSIONS, Permission, Role


async def get_current_shop_role(user: AuthenticatedUser = Depends(get_current_user)) -> Role:
    """Resolves the authenticated user's role for the requested shop.

    Placeholder: real resolution requires the `shop_members` table, which is
    out of scope until the business/database phase. `require_role` and
    `require_permission` below establish the reusable dependency shape that
    future routes will plug into once this is implemented.
    """
    raise NotImplementedError("Shop membership role resolution is not implemented until the business phase.")


def require_role(*allowed: Role) -> Callable[..., Coroutine[Any, Any, Role]]:
    async def dependency(role: Role = Depends(get_current_shop_role)) -> Role:
        if role not in allowed:
            raise AuthorizationError()
        return role

    return dependency


def require_permission(permission: Permission) -> Callable[..., Coroutine[Any, Any, Role]]:
    async def dependency(role: Role = Depends(get_current_shop_role)) -> Role:
        if permission not in ROLE_PERMISSIONS.get(role, set()):
            raise AuthorizationError()
        return role

    return dependency

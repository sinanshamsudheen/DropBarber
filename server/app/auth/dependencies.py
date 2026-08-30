from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.auth.schemas import AuthenticatedUser
from app.auth.service import resolve_authenticated_user
from app.core.config import Settings, get_settings
from app.core.errors import AuthenticationError
from app.core.logging import user_id_var

_bearer_scheme = HTTPBearer(auto_error=False)


async def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer_scheme),
    settings: Settings = Depends(get_settings),
) -> AuthenticatedUser:
    """Resolves the authenticated identity from the Authorization header.

    request -> Authorization header -> Bearer token -> JWT verification ->
    authenticated subject. Raises AuthenticationError when the header is
    missing or the token fails verification.
    """
    if credentials is None or not credentials.credentials:
        raise AuthenticationError("Missing authentication credentials.")

    user = resolve_authenticated_user(credentials.credentials, settings)

    request.state.user_id = str(user.id)
    user_id_var.set(str(user.id))
    return user


async def get_bearer_token(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer_scheme),
) -> str:
    """The raw, still-verified-by-get_current_user bearer token, for the
    rare case (Supabase Storage) where we need to forward the caller's own
    credential to another service rather than just their parsed identity.
    """
    if credentials is None or not credentials.credentials:
        raise AuthenticationError("Missing authentication credentials.")
    return credentials.credentials


async def get_current_user_optional(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer_scheme),
    settings: Settings = Depends(get_settings),
) -> AuthenticatedUser | None:
    """Like get_current_user, but returns None instead of raising when there's
    no (or an invalid) bearer token — for routes that are public but still
    want the RLS-aware session to know who's asking, if anyone.
    """
    if credentials is None or not credentials.credentials:
        return None
    try:
        return await get_current_user(request, credentials, settings)
    except AuthenticationError:
        return None

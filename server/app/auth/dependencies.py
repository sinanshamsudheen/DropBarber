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

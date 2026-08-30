from app.auth.schemas import AuthenticatedUser
from app.core.config import Settings
from app.core.errors import AuthenticationError
from app.core.security import decode_access_token


def resolve_authenticated_user(token: str, settings: Settings) -> AuthenticatedUser:
    """Verifies a bearer token and maps its claims to an AuthenticatedUser."""
    claims = decode_access_token(token, settings)
    subject = claims.get("sub")
    if not subject:
        raise AuthenticationError("Authentication token is missing a subject claim.")
    return AuthenticatedUser(id=subject, email=claims.get("email"))

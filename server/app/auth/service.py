from app.auth.schemas import AuthenticatedUser
from app.core.config import Settings
from app.core.security import decode_access_token


def resolve_authenticated_user(token: str, settings: Settings) -> AuthenticatedUser:
    """Verifies a bearer token and maps its claims to an AuthenticatedUser."""
    claims = decode_access_token(token, settings)
    return AuthenticatedUser(id=claims.sub, email=claims.email)

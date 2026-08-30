from __future__ import annotations

from typing import TYPE_CHECKING, Any

import jwt

from app.core.config import Settings
from app.core.errors import AuthenticationError

if TYPE_CHECKING:
    from jwt.types import Options


def decode_access_token(token: str, settings: Settings) -> dict[str, Any]:
    """Verify and decode a Supabase-issued JWT access token.

    Raises AuthenticationError for any missing/invalid signature, expiration,
    or audience mismatch — never trust a token that fails verification.
    """
    options: Options = {"verify_aud": bool(settings.jwt_audience)}
    try:
        return jwt.decode(
            token,
            settings.jwt_secret_key,
            algorithms=[settings.jwt_algorithm],
            audience=settings.jwt_audience or None,
            issuer=settings.jwt_issuer or None,
            options=options,
        )
    except jwt.PyJWTError as exc:
        raise AuthenticationError("Invalid or expired authentication token.") from exc

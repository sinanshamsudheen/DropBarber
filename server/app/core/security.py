from functools import lru_cache

import jwt
from jwt import PyJWKClient
from pydantic import BaseModel, Field, ValidationError

from app.core.config import Settings
from app.core.errors import AuthenticationError


class JWTClaims(BaseModel):
    """The subset of a verified Supabase JWT's claims this backend reads.

    Only parsed *after* `jwt.decode()` has already verified the signature,
    expiration, and audience — this model exists to give the two claims we
    actually use (`sub`, `email`) a validated, typed shape instead of loose
    `dict[str, Any]` access, not to re-verify the token. Extra claims
    (`aud`, `exp`, `role`, `app_metadata`, ...) are ignored.
    """

    sub: str = Field(min_length=1)
    email: str | None = None


@lru_cache(maxsize=8)
def _get_jwks_client(jwks_url: str) -> PyJWKClient:
    # cache_keys keeps the fetched public keys in memory for `lifespan`
    # seconds so we don't hit Supabase Auth's JWKS endpoint on every request.
    return PyJWKClient(jwks_url, cache_keys=True, lifespan=300)


def decode_access_token(token: str, settings: Settings) -> JWTClaims:
    """Verify and decode a Supabase-issued JWT access token.

    Supabase Auth signs real user session tokens asymmetrically (ES256) and
    publishes the corresponding public keys via its JWKS endpoint — this
    backend never holds a shared signing secret. Raises AuthenticationError
    for any missing/invalid signature, expiration, audience mismatch, or
    (via JWTClaims) missing subject claim — never trust a token that fails
    verification or validation.
    """
    try:
        jwks_client = _get_jwks_client(settings.supabase_jwks_url)
        signing_key = jwks_client.get_signing_key_from_jwt(token)
        claims = jwt.decode(
            token,
            signing_key.key,
            algorithms=["ES256"],
            audience=settings.jwt_audience or None,
            issuer=settings.jwt_issuer or None,
            options={"verify_aud": bool(settings.jwt_audience)},
        )
        return JWTClaims.model_validate(claims)
    except jwt.PyJWTError as exc:
        raise AuthenticationError("Invalid or expired authentication token.") from exc
    except ValidationError as exc:
        raise AuthenticationError("Authentication token is missing a subject claim.") from exc

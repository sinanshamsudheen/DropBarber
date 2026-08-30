import uuid
from unittest.mock import MagicMock

import httpx
import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import ec
from fastapi.security import HTTPAuthorizationCredentials

from app.auth.dependencies import get_current_user
from app.core.config import get_settings
from app.core.errors import AuthenticationError


def _request():
    return MagicMock(state=MagicMock())


async def test_get_current_user_rejects_missing_credentials():
    with pytest.raises(AuthenticationError):
        await get_current_user(request=_request(), credentials=None, settings=get_settings())


async def test_get_current_user_rejects_garbage_token():
    credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials="not-a-real-jwt")
    with pytest.raises(AuthenticationError):
        await get_current_user(request=_request(), credentials=credentials, settings=get_settings())


async def _signup_real_user(settings) -> str:
    """Signs up a throwaway user against the local Supabase Auth stack and
    returns a genuine, correctly-signed access token. Real user session
    tokens are signed asymmetrically (ES256) with a key this test suite
    doesn't hold — so "valid"/"invalid signature" cases must be built from a
    real token rather than hand-minted, unlike a shared-secret scheme.
    """
    async with httpx.AsyncClient(timeout=5.0) as client:
        response = await client.post(
            f"{settings.supabase_url}/auth/v1/signup",
            headers={"apikey": settings.supabase_anon_key},
            json={"email": f"test-{uuid.uuid4().hex[:12]}@example.com", "password": "test-password-123"},
        )
    response.raise_for_status()
    return response.json()["access_token"]


@pytest.fixture
async def real_access_token():
    settings = get_settings()
    try:
        async with httpx.AsyncClient(timeout=2.0) as client:
            await client.get(f"{settings.supabase_url}/auth/v1/health")
    except httpx.HTTPError as exc:
        pytest.skip(f"No reachable local Supabase Auth stack: {exc}")
    return await _signup_real_user(settings)


async def test_get_current_user_accepts_valid_token(real_access_token):
    credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials=real_access_token)
    user = await get_current_user(request=_request(), credentials=credentials, settings=get_settings())
    claims = jwt.decode(real_access_token, options={"verify_signature": False})
    assert str(user.id) == claims["sub"]


async def test_get_current_user_rejects_wrong_signature(real_access_token):
    """A token with a real `kid` (so the JWKS lookup succeeds) but signed by
    a different key entirely must fail signature verification.
    """
    header = jwt.get_unverified_header(real_access_token)
    claims = jwt.decode(real_access_token, options={"verify_signature": False})
    wrong_key = ec.generate_private_key(ec.SECP256R1())
    forged = jwt.encode(claims, wrong_key, algorithm="ES256", headers={"kid": header["kid"]})

    credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials=forged)
    with pytest.raises(AuthenticationError):
        await get_current_user(request=_request(), credentials=credentials, settings=get_settings())

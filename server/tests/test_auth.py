from unittest.mock import MagicMock

import jwt
import pytest
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


async def test_get_current_user_rejects_expired_token():
    settings = get_settings()
    expired_token = jwt.encode(
        {"sub": "11111111-1111-1111-1111-111111111111", "aud": settings.jwt_audience, "exp": 1},
        settings.jwt_secret_key,
        algorithm=settings.jwt_algorithm,
    )
    credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials=expired_token)
    with pytest.raises(AuthenticationError):
        await get_current_user(request=_request(), credentials=credentials, settings=settings)


async def test_get_current_user_accepts_valid_token():
    settings = get_settings()
    user_id = "11111111-1111-1111-1111-111111111111"
    token = jwt.encode(
        {"sub": user_id, "aud": settings.jwt_audience, "exp": 9999999999},
        settings.jwt_secret_key,
        algorithm=settings.jwt_algorithm,
    )
    credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)
    user = await get_current_user(request=_request(), credentials=credentials, settings=settings)
    assert str(user.id) == user_id

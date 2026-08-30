"""A thin proxy to Supabase Auth's (GoTrue) REST API.

The frontend never talks to Supabase directly and this backend never stores
or checks a password itself — GoTrue remains the sole credential store, we
just forward the request/response over our own /api/v1/auth/* routes so the
frontend's data-access layer stays organized by domain (auth is one, like
shops/appointments/etc.) the same way every other domain is.
"""

import httpx

from app.auth.schemas import (
    GoTruePasswordLoginRequest,
    GoTrueRefreshRequest,
    GoTrueSession,
    GoTrueSignupMetadata,
    GoTrueSignupRequest,
)
from app.core.config import Settings
from app.core.errors import AuthenticationError, BadRequestError

_BASE_PATH = "/auth/v1"


def _extract_error_message(response: httpx.Response) -> str:
    try:
        body = response.json()
    except ValueError:
        return "The request could not be completed."
    return (
        body.get("msg")
        or body.get("error_description")
        or body.get("message")
        or body.get("error")
        or ("The request could not be completed.")
    )


async def _post(
    settings: Settings, path: str, *, json: dict | None = None, headers: dict | None = None
) -> httpx.Response:
    request_headers = {"apikey": settings.supabase_anon_key}
    if headers:
        request_headers.update(headers)
    async with httpx.AsyncClient(timeout=10.0) as client:
        return await client.post(
            f"{settings.supabase_url}{_BASE_PATH}{path}", json=json or {}, headers=request_headers
        )


async def register(settings: Settings, email: str, password: str, display_name: str | None) -> GoTrueSession:
    payload = GoTrueSignupRequest(
        email=email,
        password=password,
        data=GoTrueSignupMetadata(display_name=display_name) if display_name else None,
    )
    response = await _post(settings, "/signup", json=payload.model_dump(exclude_none=True))
    if response.status_code >= 400:
        raise BadRequestError(message=_extract_error_message(response))
    return GoTrueSession.model_validate(response.json())


async def login(settings: Settings, email: str, password: str) -> GoTrueSession:
    payload = GoTruePasswordLoginRequest(email=email, password=password)
    response = await _post(settings, "/token?grant_type=password", json=payload.model_dump())
    if response.status_code >= 400:
        raise AuthenticationError("Invalid email or password.")
    return GoTrueSession.model_validate(response.json())


async def refresh(settings: Settings, refresh_token: str) -> GoTrueSession:
    payload = GoTrueRefreshRequest(refresh_token=refresh_token)
    response = await _post(settings, "/token?grant_type=refresh_token", json=payload.model_dump())
    if response.status_code >= 400:
        raise AuthenticationError("Invalid or expired refresh token.")
    return GoTrueSession.model_validate(response.json())


async def logout(settings: Settings, access_token: str) -> None:
    # Idempotent by design: whether or not the session was already gone,
    # the caller's intent (be logged out) is satisfied either way.
    await _post(settings, "/logout?scope=local", headers={"Authorization": f"Bearer {access_token}"})

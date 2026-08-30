from uuid import UUID

from pydantic import BaseModel


class AuthenticatedUser(BaseModel):
    """The verified identity extracted from a Supabase JWT access token.

    Always derived from the token itself — never from a client-supplied
    body field.
    """

    id: UUID
    email: str | None = None


class RegisterIn(BaseModel):
    email: str
    password: str
    display_name: str | None = None


class LoginIn(BaseModel):
    email: str
    password: str


class RefreshIn(BaseModel):
    refresh_token: str


class SessionOut(BaseModel):
    access_token: str
    refresh_token: str
    expires_at: int
    user_id: UUID
    email: str | None


class MembershipOut(BaseModel):
    shop_id: UUID
    shop_name: str
    role: str
    barber_id: UUID | None


class MeOut(BaseModel):
    id: UUID
    email: str | None
    display_name: str | None
    avatar_url: str | None
    memberships: list[MembershipOut]


class GoTrueUser(BaseModel):
    """The subset of GoTrue's user object this backend actually reads.

    Extra fields GoTrue returns (aud, role, app_metadata, ...) are ignored
    rather than rejected — Pydantic's default `extra="ignore"` — since this
    model exists to validate the fields we depend on, not to mirror every
    field of an external API we don't control.
    """

    id: UUID
    email: str | None = None


class GoTrueSession(BaseModel):
    """The subset of a GoTrue signup/login/refresh response this backend
    reads. Parsing the raw JSON through this model means a malformed or
    differently-shaped GoTrue response fails with a clear validation error
    instead of an unhandled KeyError deep in a route handler."""

    access_token: str
    refresh_token: str
    expires_at: int
    user: GoTrueUser


class GoTrueSignupMetadata(BaseModel):
    display_name: str | None = None


class GoTrueSignupRequest(BaseModel):
    email: str
    password: str
    data: GoTrueSignupMetadata | None = None


class GoTruePasswordLoginRequest(BaseModel):
    email: str
    password: str


class GoTrueRefreshRequest(BaseModel):
    refresh_token: str

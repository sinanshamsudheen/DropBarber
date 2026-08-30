from uuid import UUID

from pydantic import BaseModel


class AuthenticatedUser(BaseModel):
    """The verified identity extracted from a Supabase JWT access token.

    Always derived from the token itself — never from a client-supplied
    body field.
    """

    id: UUID
    email: str | None = None

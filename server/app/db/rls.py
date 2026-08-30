"""PostgreSQL RLS integration boundary.

No business tables or policies exist yet — this module documents and wires
the *mechanism* future RLS policies will rely on, so it can be adopted
without changing how routes obtain a database session.

Flow once business tables/policies exist:

    JWT (verified by app.auth)
      -> AuthenticatedUser (app.auth.schemas)
      -> FastAPI authorization (app.permissions)
      -> set_rls_context() below, run inside the request's DB transaction
      -> Postgres session GUCs `request.jwt.claims` / `request.jwt.claim.sub`
      -> RLS policies (e.g. `USING (shop_id IN (SELECT ... auth.uid() ...))`)
      -> only the caller's authorized rows are ever returned

We mirror Supabase PostgREST's own convention for these GUCs (rather than
inventing a new one) so future RLS policies can keep using the same
`auth.uid()` / `auth.jwt()` helper functions Supabase provides, even though
requests are served by this FastAPI app instead of PostgREST.

Application code must never treat itself as the sole authorization
mechanism: RBAC dependencies decide whether an operation is attempted, but
RLS policies are the backstop that decide which rows a query can actually
see, independent of what the application layer intended.
"""

import json

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.schemas import AuthenticatedUser


async def set_rls_context(session: AsyncSession, user: AuthenticatedUser | None) -> None:
    """Propagates the authenticated identity to Postgres session GUCs.

    Uses `SET LOCAL` so the setting is scoped to the current transaction
    only, never leaking across pooled-connection reuse.
    """
    claims = {"sub": str(user.id)} if user else {}
    await session.execute(text("SELECT set_config('request.jwt.claims', :claims, true)"), {"claims": json.dumps(claims)})
    await session.execute(
        text("SELECT set_config('request.jwt.claim.sub', :sub, true)"),
        {"sub": str(user.id) if user else ""},
    )

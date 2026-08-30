from collections.abc import AsyncGenerator

from fastapi import Depends
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker, create_async_engine

from app.auth.dependencies import get_current_user_optional
from app.auth.schemas import AuthenticatedUser
from app.core.config import Settings, get_settings
from app.db.rls import set_rls_context
from app.users.models import User

_engine: AsyncEngine | None = None
_session_factory: async_sessionmaker[AsyncSession] | None = None


def get_engine(settings: Settings | None = None) -> AsyncEngine:
    global _engine
    if _engine is None:
        settings = settings or get_settings()
        _engine = create_async_engine(
            settings.database_url,
            pool_pre_ping=True,
            pool_recycle=1800,
            echo=False,
        )
    return _engine


def get_session_factory() -> async_sessionmaker[AsyncSession]:
    global _session_factory
    if _session_factory is None:
        _session_factory = async_sessionmaker(get_engine(), expire_on_commit=False)
    return _session_factory


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency yielding a request-scoped async session."""
    session_factory = get_session_factory()
    async with session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


async def get_rls_db(
    session: AsyncSession = Depends(get_db),
    user: AuthenticatedUser | None = Depends(get_current_user_optional),
) -> AsyncSession:
    """The standard DB dependency for business routes, public or private.

    Propagates the (possibly absent) authenticated identity into Postgres
    session GUCs so Phase 2's RLS policies are always in effect — public
    routes still go through this so anonymous reads are governed by the same
    `shops_select_public`-style policies rather than an app-level bypass.
    """
    await set_rls_context(session, user)
    if user is not None:
        await _ensure_user_row(session, user)
    return session


async def _ensure_user_row(session: AsyncSession, user: AuthenticatedUser) -> None:
    """Belt-and-suspenders for the `on_auth_user_created` Postgres trigger,
    which normally creates this row when Supabase Auth inserts into
    `auth.users` — a verified JWT is always sufficient to guarantee this row
    exists regardless of trigger timing.
    """
    stmt = pg_insert(User).values(id=user.id, email=user.email).on_conflict_do_nothing(index_elements=["id"])
    await session.execute(stmt)


async def dispose_engine() -> None:
    """Cleanly closes all pooled connections on application shutdown."""
    global _engine, _session_factory
    if _engine is not None:
        await _engine.dispose()
    _engine = None
    _session_factory = None

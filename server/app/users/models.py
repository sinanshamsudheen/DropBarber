import uuid

from sqlalchemy import UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.db.mixins import TimestampMixin


class User(TimestampMixin, Base):
    """A platform account. Identity/credentials live in Supabase Auth (auth.users);
    this row is auto-created by a database trigger on signup (see the Phase 2
    migration) and never stores passwords or tokens.

    id has a real `FOREIGN KEY ... REFERENCES auth.users(id) ON DELETE CASCADE`
    at the database level (added via raw DDL in the migration, not declared as
    a SQLAlchemy ForeignKey here) — auth.users lives outside this app's
    metadata/Alembic ownership, so representing it as a mapped ForeignKey
    would make SQLAlchemy try to resolve a table it doesn't know about.
    """

    __tablename__ = "users"
    __table_args__ = (
        UniqueConstraint("email", name="uq_users_email"),
        UniqueConstraint("phone", name="uq_users_phone"),
    )

    # Not a generated UUID: this must equal the corresponding auth.users.id,
    # set by the on_auth_user_created trigger, never by the application.
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
    email: Mapped[str | None] = mapped_column(default=None)
    phone: Mapped[str | None] = mapped_column(default=None)
    display_name: Mapped[str | None] = mapped_column(default=None)
    avatar_url: Mapped[str | None] = mapped_column(default=None)

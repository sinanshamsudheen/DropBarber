"""Phase 2 RLS verification.

Exercises the 7 scenarios from the Phase 2 spec directly against Postgres
(no business API routes exist yet to test through). Requires a real,
migrated database — set DATABASE_URL to the local Supabase CLI stack
(`npx supabase start` from the repo root, then `alembic upgrade head`).
Skipped automatically if that database isn't reachable, consistent with
Phase 1's "don't assume a live DB" stance.

Every scenario runs inside a SAVEPOINT within one rolled-back outer
transaction, so this test never leaves data behind.
"""

import uuid

import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncConnection, create_async_engine

from app.core.config import get_settings

OWNER_A = uuid.UUID("11111111-1111-1111-1111-111111111111")
CUSTOMER_A = uuid.UUID("22222222-2222-2222-2222-222222222222")
SHOP_A = uuid.UUID("33333333-3333-3333-3333-333333333333")
MEMBER_A = uuid.UUID("44444444-4444-4444-4444-444444444444")
BARBER_A = uuid.UUID("55555555-5555-5555-5555-555555555555")
SERVICE_A = uuid.UUID("66666666-6666-6666-6666-666666666666")
APPOINTMENT_A = uuid.UUID("77777777-7777-7777-7777-777777777777")
OWNER_B = uuid.UUID("88888888-8888-8888-8888-888888888888")
CUSTOMER_B = uuid.UUID("99999999-9999-9999-9999-999999999999")
SHOP_B = uuid.UUID("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")


@pytest.fixture
async def db_conn():
    settings = get_settings()
    engine = create_async_engine(settings.database_url)
    try:
        async with engine.connect() as conn:
            try:
                await conn.execute(text("SELECT 1"))
            except Exception as exc:  # pragma: no cover - environment dependent
                pytest.skip(f"No reachable database for schema/RLS tests: {exc}")
            # `execute` above already auto-began a transaction; seed within
            # it and roll the whole thing back at the end.
            await _seed(conn)
            try:
                yield conn
            finally:
                await conn.rollback()
    finally:
        await engine.dispose()


async def _seed(conn: AsyncConnection) -> None:
    await conn.execute(
        text("""
            INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password,
                                     raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
            VALUES
                ('00000000-0000-0000-0000-000000000000', :owner_a, 'authenticated', 'authenticated',
                 'owner-a@test.com', 'x', '{}', '{}', now(), now()),
                ('00000000-0000-0000-0000-000000000000', :customer_a, 'authenticated', 'authenticated',
                 'customer-a@test.com', 'x', '{}', '{}', now(), now()),
                ('00000000-0000-0000-0000-000000000000', :owner_b, 'authenticated', 'authenticated',
                 'owner-b@test.com', 'x', '{}', '{}', now(), now()),
                ('00000000-0000-0000-0000-000000000000', :customer_b, 'authenticated', 'authenticated',
                 'customer-b@test.com', 'x', '{}', '{}', now(), now())
        """),
        {"owner_a": OWNER_A, "customer_a": CUSTOMER_A, "owner_b": OWNER_B, "customer_b": CUSTOMER_B},
    )
    await conn.execute(
        text("""
            INSERT INTO shops (id, name, address_line_1, city, country,
                               latitude, longitude, timezone, status)
            VALUES
                (:shop_a, 'Shop A', '1 Main St', 'Metropolis', 'US',
                 40.0, -73.0, 'America/New_York', 'active'),
                (:shop_b, 'Shop B', '2 Side St', 'Gotham', 'US',
                 41.0, -74.0, 'America/New_York', 'active')
        """),
        {"shop_a": SHOP_A, "shop_b": SHOP_B},
    )
    await conn.execute(
        text("""
            INSERT INTO shop_members (id, shop_id, user_id, role, status)
            VALUES (:member_a, :shop_a, :owner_a, 'owner', 'active')
        """),
        {"member_a": MEMBER_A, "shop_a": SHOP_A, "owner_a": OWNER_A},
    )
    await conn.execute(
        text("""
            INSERT INTO shop_members (shop_id, user_id, role, status)
            VALUES (:shop_b, :owner_b, 'owner', 'active')
        """),
        {"shop_b": SHOP_B, "owner_b": OWNER_B},
    )
    await conn.execute(
        text("""
            INSERT INTO barber_profiles (id, shop_member_id, display_name, status)
            VALUES (:barber_a, :member_a, 'Barber A', 'active')
        """),
        {"barber_a": BARBER_A, "member_a": MEMBER_A},
    )
    await conn.execute(
        text("""
            INSERT INTO services (id, shop_id, name, price, currency, status)
            VALUES (:service_a, :shop_a, 'Haircut', 25.00, 'USD', 'active')
        """),
        {"service_a": SERVICE_A, "shop_a": SHOP_A},
    )
    await conn.execute(
        text("""
            INSERT INTO shop_customers (shop_id, customer_user_id, notes)
            VALUES (:shop_a, :customer_a, 'Shop A private note'),
                   (:shop_b, :customer_b, 'Shop B private note')
        """),
        {"shop_a": SHOP_A, "customer_a": CUSTOMER_A, "shop_b": SHOP_B, "customer_b": CUSTOMER_B},
    )
    await conn.execute(
        text("""
            INSERT INTO appointments (id, shop_id, customer_user_id, barber_profile_id, service_id,
                                       start_at, end_at, status)
            VALUES (:appointment_a, :shop_a, :customer_a, :barber_a, :service_a,
                    '2026-09-01T10:00:00Z', '2026-09-01T10:30:00Z', 'booked')
        """),
        {
            "appointment_a": APPOINTMENT_A,
            "shop_a": SHOP_A,
            "customer_a": CUSTOMER_A,
            "barber_a": BARBER_A,
            "service_a": SERVICE_A,
        },
    )


async def _count_as(conn: AsyncConnection, user_id: uuid.UUID | None, sql: str) -> int:
    """Runs `sql` (a SELECT count(*) ...) impersonating `user_id` (or anon
    if None) inside a savepoint, then rolls the savepoint back.
    """
    nested = await conn.begin_nested()
    try:
        await conn.execute(text("SET LOCAL ROLE authenticated" if user_id else "SET LOCAL ROLE anon"))
        if user_id:
            # SET doesn't accept bind parameters; set_config() does (same
            # pattern as app/db/rls.py:set_rls_context).
            await conn.execute(
                text("SELECT set_config('request.jwt.claims', :claims, true)"),
                {"claims": f'{{"sub":"{user_id}"}}'},
            )
        result = await conn.execute(text(sql))
        return result.scalar_one()
    finally:
        await nested.rollback()


async def test_customer_can_access_own_appointment(db_conn):
    count = await _count_as(
        db_conn, CUSTOMER_A, f"SELECT count(*) FROM appointments WHERE id = '{APPOINTMENT_A}'"
    )
    assert count == 1


async def test_customer_cannot_access_another_customers_appointment(db_conn):
    count = await _count_as(
        db_conn, CUSTOMER_B, f"SELECT count(*) FROM appointments WHERE id = '{APPOINTMENT_A}'"
    )
    assert count == 0


async def test_shop_a_staff_can_access_shop_a_customer_relationship(db_conn):
    count = await _count_as(
        db_conn, OWNER_A, f"SELECT count(*) FROM shop_customers WHERE shop_id = '{SHOP_A}'"
    )
    assert count == 1


async def test_shop_a_staff_cannot_access_shop_b_customer_relationship(db_conn):
    count = await _count_as(
        db_conn, OWNER_A, f"SELECT count(*) FROM shop_customers WHERE shop_id = '{SHOP_B}'"
    )
    assert count == 0


async def test_shop_a_staff_only_sees_shop_a_appointments(db_conn):
    count = await _count_as(db_conn, OWNER_A, "SELECT count(*) FROM appointments")
    assert count == 1  # only the Shop A appointment seeded above


async def test_public_cannot_read_private_crm_notes(db_conn):
    count = await _count_as(db_conn, None, "SELECT count(*) FROM shop_customers")
    assert count == 0


async def test_public_can_read_active_shops(db_conn):
    # >= 2, not ==: the shared local dev DB may carry other active shops
    # from other tests/manual use; what matters is that both of this test's
    # own seeded shops are among the publicly visible ones.
    count = await _count_as(
        db_conn,
        None,
        f"SELECT count(*) FROM shops WHERE status = 'active' AND id IN ('{SHOP_A}', '{SHOP_B}')",
    )
    assert count == 2


async def test_unauthorized_customer_cannot_read_shop_membership(db_conn):
    count = await _count_as(
        db_conn, CUSTOMER_B, f"SELECT count(*) FROM shop_members WHERE shop_id = '{SHOP_A}'"
    )
    assert count == 0

# DropBarber Backend

## What this is

The backend for a location-based barber marketplace + shop CRM/appointment system. It is a **modular monolith** (not microservices) that will eventually implement the API described in `../docs/api.md` against the schema in `../docs/db_er.md`.

**This is Phase 1: foundation only.** No shop/barber/customer/appointment models, tables, or business routes exist yet — see "Phase 1 scope" below.

## Stack

- Python 3.11+, [uv](https://docs.astral.sh/uv/) for dependency management
- FastAPI + Uvicorn (ASGI)
- SQLAlchemy 2.x (async, `asyncpg` driver) against Supabase PostgreSQL
- Alembic (async-compatible migration environment)
- Pydantic v2 / pydantic-settings for config and validation
- JWT auth via Supabase-issued access tokens (PyJWT, HS256 shared secret)
- RBAC foundation + PostgreSQL RLS integration boundary

## Local setup

```sh
cd server
uv sync              # installs deps + creates .venv, from pyproject.toml/uv.lock
cp .env.example .env  # then fill in real values
```

## Environment variables

| Variable | Purpose |
|---|---|
| `APP_ENV` | `development` / `production` etc. |
| `APP_NAME` | Display name, used in OpenAPI title |
| `APP_VERSION` | App version, used in OpenAPI |
| `LOG_LEVEL` | Python logging level (e.g. `INFO`, `DEBUG`) |
| `DATABASE_URL` | Async SQLAlchemy URL, e.g. `postgresql+asyncpg://user:pass@host:5432/db` |
| `JWT_SECRET_KEY` | Supabase project JWT secret (Project Settings > API) — used to verify access tokens |
| `JWT_AUDIENCE` | Expected `aud` claim, Supabase default is `authenticated` |
| `JWT_ISSUER` | Optional expected `iss` claim; leave blank to skip issuer verification |
| `CORS_ALLOWED_ORIGINS` | Comma-separated list of allowed frontend origins (no wildcard) |

Never commit a real `.env`. `.env.example` documents the shape only.

## Running the API

```sh
uv run uvicorn app.main:app --reload
```

- `GET /health` — liveness, always 200 if the process is up
- `GET /health/ready` — readiness, 200 if the database is reachable, 503 otherwise
- All future business endpoints live under `/api/v1/...`

## Alembic

```sh
uv run alembic revision --autogenerate -m "add something"
uv run alembic upgrade head
```

`alembic/env.py` builds its connection URL from `Settings` (i.e. `DATABASE_URL`), not from `alembic.ini`, so no credential is duplicated/committed. Future domain models must be imported at the top of `alembic/env.py` so they register on `Base.metadata` (`app/db/base.py`) before autogenerate can see them.

No migrations exist yet — `alembic/versions/` is intentionally empty until the business schema phase.

## Tests

```sh
uv run pytest
```

Covers only the foundation: app startup, `/health` + `/health/ready`, the JWT auth dependency's accept/reject behavior, and config loading/validation. `/health/ready` is asserted to return a well-formed envelope with status `200` or `503` — a real Postgres instance is not assumed to be running.

## How authentication works

Supabase Auth issues JWT access tokens to the frontend. The frontend sends them as `Authorization: Bearer <token>`. This backend:

1. Extracts the bearer token (`app/auth/dependencies.py`)
2. Verifies signature/expiration/audience with the shared `JWT_SECRET_KEY` (`app/core/security.py`, HS256)
3. Maps the verified claims to an `AuthenticatedUser` (`app/auth/schemas.py`)

The authenticated user's identity always comes from the verified token — never from a client-supplied body field. Password/credential storage stays entirely in Supabase Auth; this backend never stores or hashes passwords.

## How RLS/RBAC will fit in

Per `../docs/security.md`, authorization is layered: **Supabase Auth/JWT → FastAPI authentication → RBAC → PostgreSQL RLS**.

- **RBAC** (`app/permissions/`): `Role` (customer/owner/manager/barber) and `Permission` are defined now as a reusable, centralized mapping (`ROLE_PERMISSIONS`), plus `require_role`/`require_permission` dependency factories. Resolving *which* role a user holds *at a given shop* depends on the `shop_members` table, which doesn't exist yet — that resolver is a deliberate `NotImplementedError` stub until the business phase.
- **RLS** (`app/db/rls.py`): documents and implements the mechanism (not policies) by which the verified JWT identity is propagated into Postgres session GUCs (`request.jwt.claims` / `request.jwt.claim.sub`, mirroring Supabase's own PostgREST convention) inside each request's transaction, so future RLS policies can use the same `auth.uid()`-style helpers Supabase provides. No tables or policies exist yet, so this is wired but currently a no-op in practice.

The application layer is never meant to be the sole authorization boundary — RBAC decides what's attempted, RLS is the database-level backstop.

## Phase 1 scope

Implemented: app skeleton, environment config, async DB session scaffolding, SQLAlchemy declarative base, Alembic wiring, JWT verification, auth dependency, RBAC data/dependency shape, RLS integration boundary, API versioning (`/api/v1`), health/readiness endpoints, global JSON error envelope, CORS, request ID + structured logging, foundation tests.

**Not implemented (intentionally deferred):** shop/barber/service/appointment/customer/review/points/media models and tables, any business CRUD routes, booking/availability logic, shop-membership-based role resolution, actual RLS policies, payments/branches/loyalty/messaging/inventory/payroll. These arrive once `docs/db_er.md` is implemented as SQLAlchemy models with the first Alembic migration.

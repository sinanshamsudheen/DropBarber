import os

# Matches the local Supabase CLI stack (`npx supabase start` from the repo
# root) so tests/test_schema.py can run against a real, migrated database
# when one is available; other tests only need this to be well-formed.
os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://postgres:postgres@127.0.0.1:54322/postgres")
os.environ.setdefault("JWT_SECRET_KEY", "test-secret")
os.environ.setdefault("CORS_ALLOWED_ORIGINS", "http://localhost:3000")

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app as fastapi_app


@pytest.fixture
def app():
    return fastapi_app


@pytest.fixture
async def client(app):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

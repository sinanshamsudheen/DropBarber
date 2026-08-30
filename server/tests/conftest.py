import os

os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://postgres:postgres@localhost:5432/dropbarber_test")
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

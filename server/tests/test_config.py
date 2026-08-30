import pytest
from pydantic import ValidationError

from app.core.config import Settings


def test_settings_loads_from_env(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "postgresql+asyncpg://user:pass@localhost:5432/db")
    monkeypatch.setenv("JWT_SECRET_KEY", "secret")

    settings = Settings(_env_file=None)

    assert settings.database_url == "postgresql+asyncpg://user:pass@localhost:5432/db"
    assert settings.jwt_secret_key == "secret"
    assert settings.jwt_algorithm == "HS256"


def test_settings_requires_database_url_and_jwt_secret(monkeypatch):
    monkeypatch.delenv("DATABASE_URL", raising=False)
    monkeypatch.delenv("JWT_SECRET_KEY", raising=False)

    with pytest.raises(ValidationError):
        Settings(_env_file=None)


def test_cors_allowed_origins_parses_comma_separated_list(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "postgresql+asyncpg://user:pass@localhost:5432/db")
    monkeypatch.setenv("JWT_SECRET_KEY", "secret")
    monkeypatch.setenv("CORS_ALLOWED_ORIGINS", "http://a.com, http://b.com")

    settings = Settings(_env_file=None)

    assert settings.cors_allowed_origins_list == ["http://a.com", "http://b.com"]

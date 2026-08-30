from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Environment-driven application configuration."""

    model_config = SettingsConfigDict(env_file=".env", case_sensitive=False, extra="ignore")

    app_env: str = "development"
    app_name: str = "DropBarber API"
    app_version: str = "0.1.0"
    log_level: str = "INFO"

    database_url: str

    # Supabase Auth issues real user session tokens signed asymmetrically
    # (ES256) and publishes the verification keys via its own JWKS endpoint
    # — there is no shared secret to configure or store. The anon key is
    # safe to hold server-side (it's the same key Supabase's client SDKs
    # ship publicly); the service-role key is never used for normal
    # requests and has no field here.
    supabase_url: str
    supabase_anon_key: str
    jwt_audience: str = "authenticated"
    jwt_issuer: str | None = None

    # Only needs setting when the backend and the browser reach Supabase via
    # different hostnames — e.g. local Docker Compose, where the backend
    # calls Supabase server-side via `host.docker.internal` but that
    # hostname never resolves outside a container, so any URL handed back to
    # the browser (a signed upload URL, a public Storage object URL) needs
    # this instead. Defaults to `supabase_url`, which is correct for every
    # real deployment (the browser and the backend both reach the same
    # public Supabase project URL there).
    supabase_public_url: str | None = None

    cors_allowed_origins: str = ""

    @property
    def supabase_public_url_or_default(self) -> str:
        return self.supabase_public_url or self.supabase_url

    @property
    def supabase_jwks_url(self) -> str:
        return f"{self.supabase_url}/auth/v1/.well-known/jwks.json"

    @property
    def cors_allowed_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_allowed_origins.split(",") if origin.strip()]

    @property
    def is_development(self) -> bool:
        return self.app_env.lower() in {"development", "dev", "local"}


@lru_cache
def get_settings() -> Settings:
    return Settings()

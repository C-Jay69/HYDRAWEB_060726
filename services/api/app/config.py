"""Application configuration loaded from environment variables."""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "HydraWeb API"
    environment: str = "development"
    api_url: str = "http://localhost:8000"
    frontend_url: str = "http://localhost:3000"
    platform_domain: str = "myplatform.dev"

    # Database / cache
    database_url: str = "postgresql+asyncpg://hydraweb:hydraweb@localhost:5432/hydraweb"
    redis_url: str = "redis://localhost:6379/0"

    # Auth
    secret_key: str = "dev-secret-change-me-in-production-please"
    access_token_expire_minutes: int = 60 * 24 * 7
    jwt_algorithm: str = "HS256"
    auto_verify_email: bool = True

    # SMTP (optional — used for verification/reset emails when configured)
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from: str = "HydraWeb <no-reply@myplatform.dev>"

    # OAuth providers (optional — configure client ids to enable)
    github_client_id: str = ""
    github_client_secret: str = ""
    google_client_id: str = ""
    google_client_secret: str = ""

    # LLM (OpenRouter gateway)
    openrouter_api_key: str = ""
    openrouter_base_url: str = "https://openrouter.ai/api/v1"
    llm_model: str = "openai/gpt-4o"
    llm_temperature: float = 0.7
    llm_max_tokens: int = 8000
    llm_cache_ttl: int = 3600
    llm_context_window: int = 32000
    # When true (or when no API key is configured) the backend returns a
    # sample site so the whole platform can be exercised without an LLM key.
    llm_mock: bool = False

    # Stripe
    stripe_secret_key: str = ""
    stripe_webhook_secret: str = ""
    stripe_price_free: str = "prod_free"
    stripe_price_pro_monthly: str = "price_pro_monthly"
    stripe_price_pro_annual: str = "price_pro_annual"
    stripe_price_enterprise_monthly: str = "price_ent_monthly"
    stripe_price_enterprise_annual: str = "price_ent_annual"

    # Plan limits
    free_project_limit: int = 1
    pro_project_limit: int = 10
    enterprise_project_limit: int = 100000
    free_rate_limit: int = 100
    pro_rate_limit: int = 300
    enterprise_rate_limit: int = 1000
    rate_limit_enabled: bool = True

    # Storage (deployed sites / exports)
    storage_dir: str = "storage"

    # Admin emails (comma separated) — first signup gets admin otherwise
    admin_emails: str = ""

    # CORS
    cors_origins: str = "http://localhost:3000,http://localhost:5173"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def admin_email_list(self) -> list[str]:
        return [e.strip().lower() for e in self.admin_emails.split(",") if e.strip()]

    def project_limit_for(self, plan: str) -> int:
        if plan == "pro":
            return self.pro_project_limit
        if plan == "enterprise":
            return self.enterprise_project_limit
        return self.free_project_limit

    def rate_limit_for(self, plan: str) -> int:
        if plan == "pro":
            return self.pro_rate_limit
        if plan == "enterprise":
            return self.enterprise_rate_limit
        return self.free_rate_limit


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()

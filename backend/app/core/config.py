from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    debug: bool = False
    supabase_url: str
    supabase_publishable_default_key: str
    supabase_secret_default_key: str
    cors_origins: list[str] = ["http://localhost:8081", "http://localhost:19006"]

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()

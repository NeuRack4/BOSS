from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic.aliases import AliasChoices
from functools import lru_cache


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # Supabase
    supabase_url: str
    supabase_anon_key: str
    supabase_service_role_key: str

    # Anthropic
    anthropic_api_key: str
    claude_model: str = "claude-haiku-4-5-20251001"

    # Google Gemini (레거시)
    gemini_api_key: str = ""

    # Groq (Llama 3.3 70B — 무료 초안 생성)
    groq_api_key: str = ""

    # 기업마당 API
    bizinfo_api_key: str = ""

    # 서울 열린데이터광장 API (SEOUL_OPEN_API_KEY 또는 SEOUL_API_KEY 둘 다 허용)
    seoul_open_api_key: str = Field(
        default="",
        validation_alias=AliasChoices("SEOUL_OPEN_API_KEY", "SEOUL_API_KEY"),
    )

    # 공공데이터포털 API
    public_data_api_key: str = ""

    # SMTP — Resend (smtp.resend.com)
    smtp_host: str = "smtp.resend.com"
    smtp_port: int = 465
    smtp_user: str = "resend"
    smtp_password: str = ""   # Resend API 키 (re_xxx...)
    smtp_from_email: str = ""
    smtp_from_name: str = "BOSS 비서"

    # App
    app_env: str = "development"
    log_level: str = "INFO"
    cors_origins: list[str] = ["http://localhost:3000"]


@lru_cache
def get_settings() -> Settings:
    return Settings()

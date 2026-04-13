from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    """
    Infrastructure settings only.
    LLM settings (token, base URL) are stored in the database
    and managed via the Settings UI.
    """
    # PostgreSQL
    postgres_user: str = "admin"
    postgres_password: str = "changeme"
    postgres_db: str = "pc_ai_assistant"
    database_url: str = "postgresql://admin:changeme@127.0.0.1:5432/pc_ai_assistant"

    # Backend
    backend_port: int = 8000

    class Config:
        env_file = "../.env"
        extra = "ignore"
@lru_cache()
def get_settings() -> Settings:
    return Settings()
from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    """
    Reads values from .env file automatically.
    Field names must match the variable names in .env exactly.
    """

    # LLM API
    llm_api_base_url: str = "http://10.210.106.4:8080"

    # PostgreSQL
    postgres_user: str = "admin"
    postgres_password: str = "changeme"
    postgres_db: str = "pc_ai_assistant"
    database_url: str = "postgresql://admin:changeme@127.0.0.1:5432/pc_ai_assistant"

    # Backend
    backend_port: int = 8000

    class Config:
        env_file = ".env"        # tells Pydantic where to find the .env file
        extra = "ignore"         # ignore unknown variables in .env


@lru_cache()
def get_settings() -> Settings:
    """
    Returns the settings object.
    lru_cache means it only reads the .env file ONCE,
    then reuses the same object.
    """
    return Settings()
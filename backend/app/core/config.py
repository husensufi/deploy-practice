import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy.engine import URL, make_url

PROJECT_ROOT = Path(__file__).resolve().parents[3]
BACKEND_ROOT = PROJECT_ROOT / "backend"
load_dotenv(BACKEND_ROOT / ".env")


def _database_url() -> URL:
    configured_url = os.getenv("DATABASE_URL")
    if not configured_url:
        return URL.create(
            "sqlite",
            database=str((PROJECT_ROOT / "pcos_gynocare.db").resolve()),
        )

    url = make_url(configured_url)
    if url.drivername != "sqlite":
        raise ValueError("DATABASE_URL must use the existing SQLite database.")
    if not url.database or url.database == ":memory:":
        raise ValueError("DATABASE_URL must point to a persistent SQLite file.")

    database_path = Path(url.database)
    if not database_path.is_absolute():
        database_path = PROJECT_ROOT / database_path
    return url.set(database=str(database_path.resolve()))


@dataclass(frozen=True)
class Settings:
    database_url: URL
    environment: str
    secret_key: str | None
    frontend_url: str
    azure_openai_endpoint: str | None
    azure_openai_api_key: str | None
    azure_openai_deployment: str | None
    azure_openai_api_version: str | None


settings = Settings(
    database_url=_database_url(),
    environment=os.getenv("ENVIRONMENT", "development"),
    secret_key=os.getenv("SECRET_KEY"),
    frontend_url=os.getenv("FRONTEND_URL", "http://localhost:5173"),
    azure_openai_endpoint=os.getenv("AZURE_OPENAI_ENDPOINT"),
    azure_openai_api_key=os.getenv("AZURE_OPENAI_API_KEY"),
    azure_openai_deployment=os.getenv("AZURE_OPENAI_DEPLOYMENT"),
    azure_openai_api_version=os.getenv("AZURE_OPENAI_API_VERSION"),
)

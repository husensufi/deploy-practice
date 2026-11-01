from fastapi.testclient import TestClient

from app.core.config import PROJECT_ROOT, settings
from app.main import app


def test_health_endpoint_reports_api_status() -> None:
    with TestClient(app) as client:
        response = client.get("/api/v1/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_default_database_url_targets_original_project_database() -> None:
    expected_database = PROJECT_ROOT / "pcos_gynocare.db"

    assert settings.database_url.drivername == "sqlite"
    assert settings.database_url.database == str(expected_database)
    assert expected_database.is_file()

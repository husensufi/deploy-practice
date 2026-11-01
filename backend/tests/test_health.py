import os

from app.core.config import load_project_environment
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


def test_backend_env_takes_precedence_with_root_env_fallback(
    tmp_path,
    monkeypatch,
) -> None:
    project_root = tmp_path / "project"
    backend_root = project_root / "backend"
    backend_root.mkdir(parents=True)
    (backend_root / ".env").write_text(
        "PCOS_TEST_BACKEND_SETTING=backend-value\n"
        "PCOS_TEST_FALLBACK_SETTING=\n",
        encoding="utf-8",
    )
    (project_root / ".env").write_text(
        "PCOS_TEST_BACKEND_SETTING=root-value\n"
        "PCOS_TEST_FALLBACK_SETTING=root-value\n"
        "PCOS_TEST_PROCESS_SETTING=root-value\n",
        encoding="utf-8",
    )
    monkeypatch.delenv("PCOS_TEST_BACKEND_SETTING", raising=False)
    monkeypatch.delenv("PCOS_TEST_FALLBACK_SETTING", raising=False)
    monkeypatch.setenv("PCOS_TEST_PROCESS_SETTING", "process-value")

    load_project_environment(project_root, backend_root)

    assert os.environ["PCOS_TEST_BACKEND_SETTING"] == "backend-value"
    assert os.environ["PCOS_TEST_FALLBACK_SETTING"] == "root-value"
    assert os.environ["PCOS_TEST_PROCESS_SETTING"] == "process-value"

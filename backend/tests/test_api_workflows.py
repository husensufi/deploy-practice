from dataclasses import replace

import httpx
import pytest
from fastapi.testclient import TestClient
from openai import AuthenticationError
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from starlette.websockets import WebSocketDisconnect

from app.core import security
from app.api.v1.routes import chat_websocket as websocket_routes
from app.core.config import settings
from app.core.legacy import User
from app.database.session import get_db
from app.main import app
from backend.ai import azure_openai


@pytest.fixture
def client(monkeypatch):
    test_engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    User.metadata.create_all(bind=test_engine)
    test_session = sessionmaker(bind=test_engine, autoflush=False)

    def override_get_db():
        db = test_session()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    monkeypatch.setattr(websocket_routes, "SessionLocal", test_session)
    monkeypatch.setattr(
        security,
        "settings",
        replace(settings, secret_key="test-only-secret-value-long-enough"),
    )
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
    test_engine.dispose()


def register(client: TestClient, role: str = "patient") -> dict:
    response = client.post(
        "/api/v1/auth/register",
        json={
            "full_name": "Test Person",
            "email": f"{role}@example.test",
            "mobile": "+10000000001" if role == "doctor" else "+10000000000",
            "password": "test-password",
            "confirm_password": "test-password",
            "role": role,
        },
    )
    assert response.status_code == 201
    return response.json()


def test_patient_auth_assessment_and_tracker_workflow(client: TestClient) -> None:
    user = register(client)
    assert "hashed_password" not in user
    assert "access_token" in client.cookies
    assert client.get("/api/v1/auth/me").json()["id"] == user["id"]

    assessment = client.post(
        "/api/v1/assessments",
        json={
            "age": 23,
            "height_cm": 160,
            "weight_kg": 70,
            "cycle_regularity": "irregular",
            "excessive_hair_growth": True,
            "acne": True,
            "skin_darkening": True,
        },
    )
    assert assessment.status_code == 200
    assert assessment.json()["result"]["bmi"] == 27.3
    assert assessment.json()["result"]["score"] == 7
    assert assessment.json()["result"]["risk_level"] == "High"

    history = client.get("/api/v1/assessments/history")
    assert history.status_code == 200
    assert len(history.json()) == 1

    tracker = client.post(
        "/api/v1/tracker/daily",
        json={
            "on_period": True,
            "cramp_pain_level": 6,
            "water_intake_liters": 1.5,
            "exercise_minutes": 20,
            "sleep_hours": 7,
            "mood": "normal",
            "junk_food": False,
            "notes": "Test entry",
        },
    )
    assert tracker.status_code == 200
    assert tracker.json()["user_id"] == user["id"]
    record_id = tracker.json()["id"]

    updated_tracker = client.put(
        f"/api/v1/tracker/daily/{record_id}",
        json={
            "on_period": True,
            "cramp_pain_level": 5,
            "water_intake_liters": 2,
            "exercise_minutes": 25,
            "sleep_hours": 7.5,
            "mood": "happy",
            "junk_food": False,
            "notes": "Updated test entry",
        },
    )
    assert updated_tracker.status_code == 200
    assert updated_tracker.json()["notes"] == "Updated test entry"

    dashboard = client.get("/api/v1/patients/dashboard")
    assert dashboard.status_code == 200
    assert dashboard.json()["today_log"]["notes"] == "Updated test entry"
    assert dashboard.json()["screening_result"]["score"] == 7

    report = client.get("/api/v1/reports")
    assert report.status_code == 200
    assert len(report.json()["logs"]) == 1
    assert report.json()["screening_result"]["score"] == 7

    pdf = client.get("/api/v1/reports/pdf")
    assert pdf.status_code == 200
    assert pdf.headers["content-type"] == "application/pdf"
    assert pdf.content.startswith(b"%PDF")


def test_doctor_routes_are_role_protected_and_directory_uses_saved_profile(
    client: TestClient,
) -> None:
    doctor = register(client, role="doctor")
    forbidden = client.get("/api/v1/patients/me")
    assert forbidden.status_code == 403

    saved = client.put(
        "/api/v1/doctors/me",
        json={
            "clinic_name": "Test Clinic",
            "specialization": "Gynecologist",
            "city": "Test City",
            "address": "1 Test Road",
            "phone": "+10000000000",
            "consultation_hours": "Weekdays",
            "about": "",
            "photo_url": "",
        },
    )
    assert saved.status_code == 200
    assert saved.json()["user_id"] == doctor["id"]

    directory = client.get("/api/v1/doctors")
    assert directory.status_code == 200
    assert directory.json()[0]["clinic_name"] == "Test Clinic"


def test_registration_fails_before_writing_without_auth_secret(
    client: TestClient,
    monkeypatch,
) -> None:
    monkeypatch.setattr(
        security,
        "settings",
        replace(settings, secret_key=None),
    )
    response = client.post(
        "/api/v1/auth/register",
        json={
            "full_name": "Unconfigured",
            "email": "unconfigured@example.test",
            "mobile": "+10000000000",
            "password": "test-password",
            "confirm_password": "test-password",
            "role": "patient",
        },
    )
    assert response.status_code == 503


def test_chat_uses_configured_azure_openai_and_requires_authentication(
    client: TestClient,
    monkeypatch,
) -> None:
    unauthenticated = client.post(
        "/api/v1/chat/reply",
        json={"messages": [{"role": "user", "content": "What is PCOS?"}]},
    )
    assert unauthenticated.status_code == 401

    register(client)
    monkeypatch.setattr(
        azure_openai,
        "settings",
        replace(
            azure_openai.settings,
            endpoint="https://example.openai.azure.com",
            api_key="test-key",
            deployment="test-deployment",
            api_version="2024-10-21",
        ),
    )
    request_arguments = {}

    class FakeClient:
        class chat:
            class completions:
                @staticmethod
                def create(**kwargs):
                    request_arguments["completion"] = kwargs
                    message = type(
                        "Message", (), {"content": "PCOS varies by person."}
                    )()
                    choice = type("Choice", (), {"message": message})()
                    return type("Completion", (), {"choices": [choice]})()

    def create_client(endpoint, api_key, api_version):
        request_arguments["client"] = (endpoint, api_key, api_version)
        return FakeClient()

    monkeypatch.setattr(azure_openai, "_create_client", create_client)
    response = client.post(
        "/api/v1/chat/reply",
        json={
            "messages": [
                {"role": "user", "content": "What is PCOS?"},
                {"role": "assistant", "content": "I can share general information."},
                {"role": "user", "content": "Does it affect everyone equally?"},
            ],
        },
    )

    assert response.status_code == 200
    assert response.json() == {"reply": "PCOS varies by person."}
    assert request_arguments["completion"]["model"] == "test-deployment"
    assert request_arguments["completion"]["messages"][1]["content"] == "What is PCOS?"
    assert request_arguments["client"] == (
        "https://example.openai.azure.com",
        "test-key",
        "2024-10-21",
    )


def test_chat_reports_missing_azure_configuration(
    client: TestClient,
    monkeypatch,
) -> None:
    register(client)
    monkeypatch.setattr(
        azure_openai,
        "settings",
        replace(
            azure_openai.settings,
            endpoint=None,
            api_key=None,
            deployment=None,
        ),
    )
    response = client.post(
        "/api/v1/chat/reply",
        json={"messages": [{"role": "user", "content": "What is PCOS?"}]},
    )
    assert response.status_code == 503
    assert "AZURE_OPENAI_ENDPOINT" in response.json()["detail"]
    assert "AZURE_OPENAI_API_KEY" in response.json()["detail"]
    assert "AZURE_OPENAI_DEPLOYMENT" in response.json()["detail"]


def test_chat_reports_rejected_azure_credentials(
    client: TestClient,
    monkeypatch,
) -> None:
    register(client)
    error_response = httpx.Response(
        401,
        request=httpx.Request(
            "POST",
            "https://example.openai.azure.com/openai/deployments/test/chat/completions",
        ),
    )
    authentication_error = AuthenticationError(
        "Invalid API key",
        response=error_response,
        body={"error": "invalid_api_key"},
    )

    def reject_credentials(messages, *, max_tokens):
        assert messages
        assert max_tokens == 400
        raise authentication_error

    monkeypatch.setattr(azure_openai, "create_chat_completion", reject_credentials)
    response = client.post(
        "/api/v1/chat/reply",
        json={"messages": [{"role": "user", "content": "What is PCOS?"}]},
    )

    assert response.status_code == 502
    assert "rejected the configured credentials" in response.json()["detail"]
    assert "Invalid API key" not in response.json()["detail"]


def test_connection_and_care_alert_workflow(client: TestClient) -> None:
    register(client)
    patient_token = client.cookies.get(security.ACCESS_TOKEN_COOKIE)
    doctor = register(client, role="doctor")
    doctor_token = client.cookies.get(security.ACCESS_TOKEN_COOKIE)

    client.cookies.set(security.ACCESS_TOKEN_COOKIE, patient_token)
    request = client.post(
        "/api/v1/connections",
        json={
            "friend_email": doctor["email"].upper(),
            "relationship_type": "friend",
        },
    )
    assert request.status_code == 201
    connection_id = request.json()["id"]

    listed = client.get("/api/v1/connections").json()
    assert len(listed["pending_outgoing"]) == 1
    assert listed["pending_outgoing"][0]["other_user_id"] == doctor["id"]
    assert client.get(f"/api/v1/connections/{doctor['id']}/chat").status_code == 404
    assert client.post(f"/api/v1/connections/{connection_id}/accept").status_code == 404

    client.cookies.set(security.ACCESS_TOKEN_COOKIE, doctor_token)
    accepted = client.post(f"/api/v1/connections/{connection_id}/accept")
    assert accepted.status_code == 200
    assert accepted.json()["status"] == "accepted"

    client.cookies.set(security.ACCESS_TOKEN_COOKIE, patient_token)
    tracker = client.post(
        "/api/v1/tracker/daily",
        json={
            "on_period": True,
            "cramp_pain_level": 7,
            "mood": "normal",
        },
    )
    assert tracker.status_code == 200
    alert = client.post(f"/api/v1/connections/{doctor['id']}/notify")
    assert alert.status_code == 200
    assert alert.json()["message"]["message_type"] == "care_alert"
    assert "strong cramp pain (7/10)" in alert.json()["message"]["content"]

    history = client.get(f"/api/v1/connections/{doctor['id']}/chat")
    assert history.status_code == 200
    assert len(history.json()["messages"]) == 1
    assert history.json()["messages"][0]["content"] == alert.json()["message"]["content"]

    invitation = client.post(
        f"/api/v1/connections/{doctor['id']}/games/invite",
        json={"game_name": "Mind Match"},
    )
    assert invitation.status_code == 201
    assert client.get(f"/api/v1/connections/{doctor['id']}/chat").json()[
        "messages"
    ][-1]["content"].endswith("Open Games from the menu to join in.")


def test_websocket_chat_persists_messages_and_rejects_bad_origin(
    client: TestClient,
) -> None:
    patient = register(client)
    patient_token = client.cookies.get(security.ACCESS_TOKEN_COOKIE)
    doctor = register(client, role="doctor")
    doctor_token = client.cookies.get(security.ACCESS_TOKEN_COOKIE)
    client.cookies.set(security.ACCESS_TOKEN_COOKIE, patient_token)
    connection = client.post(
        "/api/v1/connections",
        json={"friend_email": doctor["email"]},
    ).json()
    client.cookies.set(security.ACCESS_TOKEN_COOKIE, doctor_token)
    client.post(f"/api/v1/connections/{connection['id']}/accept")
    client.cookies.set(security.ACCESS_TOKEN_COOKIE, patient_token)

    with pytest.raises(WebSocketDisconnect):
        with client.websocket_connect(
            f"/api/v1/ws/chat/{doctor['id']}",
            headers={"Origin": "https://untrusted.example"},
        ):
            pass
    with pytest.raises(WebSocketDisconnect):
        with client.websocket_connect(f"/api/v1/ws/chat/{doctor['id']}"):
            pass

    with client.websocket_connect(
        f"/api/v1/ws/chat/{doctor['id']}",
        headers={"Origin": settings.frontend_url},
    ) as websocket:
        websocket.send_json({"content": "Hello there"})
        delivered = websocket.receive_json()
        assert delivered["sender_id"] == patient["id"]
        assert delivered["content"] == "Hello there"

    messages = client.get(f"/api/v1/connections/{doctor['id']}/chat").json()[
        "messages"
    ]
    assert len(messages) == 1
    assert messages[0]["content"] == "Hello there"

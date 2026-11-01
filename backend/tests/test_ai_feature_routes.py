from dataclasses import replace

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core import security
from app.core.config import settings
from app.database.session import get_db
from app.main import app
from legacy.database import Base
from legacy.models import User


@pytest.fixture
def session_client(monkeypatch):
    test_engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=test_engine)
    test_session = sessionmaker(bind=test_engine, autoflush=False)

    def override_get_db():
        db = test_session()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    monkeypatch.setattr("app.main.SessionLocal", test_session)
    monkeypatch.setattr(
        security,
        "settings",
        replace(settings, secret_key="test-only-secret-value-long-enough"),
    )
    with TestClient(app) as test_client:
        yield test_client, test_session
    app.dependency_overrides.clear()
    test_engine.dispose()


def create_user(session_factory, *, email: str, role: str, full_name: str = "Test User") -> User:
    db = session_factory()
    try:
        user = User(
            full_name=full_name,
            email=email,
            mobile=f"+100000000{len(email)}",
            hashed_password="hashed-password",
            role=role,
            is_active=True,
            approval_status="approved",
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        return user
    finally:
        db.close()


def authenticate(client: TestClient, user: User) -> None:
    client.cookies.set(security.ACCESS_TOKEN_COOKIE, security.create_access_token(user.email))


def test_patient_ai_routes_return_generated_responses(session_client, monkeypatch) -> None:
    client, session = session_client
    patient = create_user(session, email="patient@example.test", role="patient", full_name="Patient User")
    authenticate(client, patient)

    def fake_generate(template_name, user_request, *, context=None, max_tokens=500):
        return f"{template_name}:{user_request}:{max_tokens}"

    monkeypatch.setattr("app.api.v1.routes.ai.generate_ai_response", fake_generate)

    gynobuddy = client.post(
        "/api/v1/ai/patient/gynobuddy/chat",
        json={"messages": [{"role": "user", "content": "What is PCOS?"}]},
    )
    insights = client.post(
        "/api/v1/ai/patient/health-insights",
        json={"prompt": "Summarize my recent symptoms"},
    )
    wellness = client.post(
        "/api/v1/ai/patient/wellness-recommendations",
        json={"goal": "Improve sleep and stress"},
    )
    report = client.post(
        "/api/v1/ai/patient/reports/summarize",
        json={"prompt": "Summarize my cycles"},
    )

    assert gynobuddy.status_code == 200
    assert gynobuddy.json()["reply"] == "gynobuddy:What is PCOS?:400"
    assert insights.status_code == 200
    assert insights.json()["summary"] == "patient_insights:Summarize my recent symptoms:500"
    assert wellness.status_code == 200
    assert wellness.json()["recommendations"] == "wellness_recommendations:Improve sleep and stress:500"
    assert report.status_code == 200
    assert report.json()["summary"] == "report_summary:Summarize my cycles:500"


def test_doctor_ai_routes_return_generated_responses(session_client, monkeypatch) -> None:
    client, session = session_client
    doctor = create_user(session, email="doctor@example.test", role="doctor", full_name="Doctor User")
    patient = create_user(session, email="patient-doctor@example.test", role="patient", full_name="Patient User")
    authenticate(client, doctor)

    def fake_generate(template_name, user_request, *, context=None, max_tokens=500):
        return f"{template_name}:{user_request}:{max_tokens}"

    monkeypatch.setattr("app.api.v1.routes.ai.generate_ai_response", fake_generate)

    patient_summary = client.post(
        f"/api/v1/ai/doctor/patients/{patient.id}/summary",
        json={"prompt": "Review patient trends"},
    )
    consultation = client.post(
        "/api/v1/ai/doctor/consultation-assistant",
        json={"prompt": "Help with my patient notes"},
    )
    doctor_report = client.post(
        "/api/v1/ai/doctor/reports/summarize",
        json={"prompt": "Summarize my recent consultations"},
    )

    assert patient_summary.status_code == 200
    assert patient_summary.json()["summary"] == "doctor_assistant:Review patient trends:500"
    assert consultation.status_code == 200
    assert consultation.json()["summary"] == "doctor_assistant:Help with my patient notes:500"
    assert doctor_report.status_code == 200
    assert doctor_report.json()["summary"] == "report_summary:Summarize my recent consultations:500"


def test_admin_ai_routes_return_generated_content(session_client, monkeypatch) -> None:
    client, session = session_client
    admin = create_user(session, email="admin@example.test", role="admin", full_name="Admin User")
    authenticate(client, admin)

    def fake_generate(template_name, user_request, *, context=None, max_tokens=500):
        return f"{template_name}:{user_request}:{max_tokens}"

    monkeypatch.setattr("app.api.v1.routes.ai.generate_ai_response", fake_generate)

    assistant_response = client.post(
        "/api/v1/ai/admin/assistant",
        json={"question": "How many patients are active?"},
    )
    content_response = client.post(
        "/api/v1/ai/admin/content-generator",
        json={
            "category": "pcos_education",
            "topic": "nutrition habits",
            "audience": "patients",
        },
    )

    assert assistant_response.status_code == 200
    assert assistant_response.json()["answer"] == "admin_assistant:How many patients are active?:500"
    assert content_response.status_code == 200
    assert content_response.json()["draft"] == "content_generation:Create a pcos_education draft about nutrition habits for patients.:700"

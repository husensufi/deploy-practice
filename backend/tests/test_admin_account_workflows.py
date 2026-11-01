from dataclasses import replace
from datetime import date, datetime

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core import security
from app.core.admin import ensure_account_admin_schema, ensure_user_schema
from app.core.config import settings
from app.core.legacy import (
    Appointment,
    DoctorProfile,
    User,
    UserNotification,
    hash_password,
)
from app.database.session import get_db
from app.main import app
from legacy.database import Base


@pytest.fixture
def account_client(monkeypatch):
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    test_session = sessionmaker(bind=engine, autoflush=False)

    def override_get_db():
        db = test_session()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    app.state.test_session = test_session
    monkeypatch.setattr("app.main.SessionLocal", test_session)
    monkeypatch.setattr(
        security,
        "settings",
        replace(settings, secret_key="test-admin-security-secret-at-least-32"),
    )
    with TestClient(app) as client:
        yield client
    app.dependency_overrides.clear()
    del app.state.test_session
    engine.dispose()


def create_account(db, *, name, email, role, active=True, approval="approved"):
    account = User(
        full_name=name,
        email=email,
        mobile=f"+100000{db.query(User).count() + 1:06d}",
        hashed_password=hash_password("InitialPass9"),
        role=role,
        is_active=active,
        approval_status=approval,
    )
    db.add(account)
    db.flush()
    return account


def authenticate(client, email, token_version=0):
    client.cookies.set(
        security.ACCESS_TOKEN_COOKIE,
        security.create_access_token(email, token_version),
    )


def test_profile_password_update_and_old_token_revocation(account_client):
    with app.state.test_session() as db:
        patient = create_account(db, name="Patient One", email="profile@example.test", role="patient")
        db.commit()
        user_id = patient.id
    old_token = security.create_access_token("profile@example.test", 0)
    authenticate(account_client, "profile@example.test")

    updated = account_client.put(
        "/api/v1/auth/profile",
        json={"full_name": "Updated Patient", "mobile": "+19999999999"},
    )
    assert updated.status_code == 200
    assert updated.json()["full_name"] == "Updated Patient"
    assert account_client.get("/api/v1/auth/me").status_code == 200

    stale_client = TestClient(app)
    stale_client.cookies.set(security.ACCESS_TOKEN_COOKIE, old_token)
    assert stale_client.get("/api/v1/auth/me").status_code == 401

    wrong_password = account_client.post(
        "/api/v1/auth/password",
        json={
            "current_password": "wrong",
            "new_password": "SecurePass10",
            "confirm_new_password": "SecurePass10",
        },
    )
    assert wrong_password.status_code == 400
    changed = account_client.post(
        "/api/v1/auth/password",
        json={
            "current_password": "InitialPass9",
            "new_password": "SecurePass10",
            "confirm_new_password": "SecurePass10",
        },
    )
    assert changed.status_code == 204
    assert "Max-Age=0" in changed.headers["set-cookie"]
    assert account_client.get("/api/v1/auth/me").status_code == 401
    account_client.cookies.clear()
    with app.state.test_session() as db:
        persisted = db.query(User).filter(User.id == user_id).one()
        assert persisted.full_name == "Updated Patient"
        assert persisted.token_version == 2
    login = account_client.post(
        "/api/v1/auth/login",
        json={"email": "profile@example.test", "password": "SecurePass10"},
    )
    assert login.status_code == 200


def test_admin_deactivation_reactivation_soft_removal_and_role_permissions(account_client):
    with app.state.test_session() as db:
        admin = create_account(db, name="Admin", email="admin@example.test", role="admin")
        patient = create_account(db, name="Patient", email="patient@example.test", role="patient")
        doctor = create_account(db, name="Doctor", email="doctor@example.test", role="doctor")
        db.add(DoctorProfile(
            user_id=doctor.id,
            clinic_name="Care Clinic",
            specialization="Gynecologist",
            city="Mangalore",
            address="Main Road",
            phone="+10000000000",
        ))
        appointment = Appointment(
            patient_id=patient.id,
            doctor_id=doctor.id,
            appointment_date=date(2030, 1, 3),
            preferred_time="10:00",
            reason="Consultation",
            status="accepted",
        )
        db.add(appointment)
        db.commit()
        patient_id, doctor_id = patient.id, doctor.id

    authenticate(account_client, "admin@example.test")
    patient_access = TestClient(app)
    authenticate(patient_access, "patient@example.test")
    assert patient_access.get("/api/v1/admin/patients").status_code == 403

    stale_patient_token = security.create_access_token("patient@example.test")
    deactivated = account_client.post(
        f"/api/v1/admin/patients/{patient_id}/status",
        json={"status": "inactive", "reason": "Admin review"},
    )
    assert deactivated.status_code == 200
    assert deactivated.json()["is_active"] is False
    old_session = TestClient(app)
    old_session.cookies.set(security.ACCESS_TOKEN_COOKIE, stale_patient_token)
    assert old_session.get("/api/v1/auth/me").status_code == 401
    assert account_client.post(
        "/api/v1/auth/login",
        json={"email": "patient@example.test", "password": "InitialPass9"},
    ).status_code == 403

    reactivated = account_client.post(
        f"/api/v1/admin/patients/{patient_id}/status",
        json={"status": "active"},
    )
    assert reactivated.status_code == 200
    doctor_inactive = account_client.post(
        f"/api/v1/admin/doctors/{doctor_id}/status",
        json={"status": "inactive"},
    )
    assert doctor_inactive.status_code == 200
    assert account_client.post(
        "/api/v1/auth/login",
        json={"email": "doctor@example.test", "password": "InitialPass9"},
    ).status_code == 403
    patient_portal = TestClient(app)
    authenticate(patient_portal, "patient@example.test", token_version=2)
    assert patient_portal.get("/api/v1/doctors").json() == []
    notifications = patient_portal.get("/api/v1/auth/notifications")
    assert notifications.status_code == 200
    assert len(notifications.json()) == 1
    assert patient_portal.post(
        f"/api/v1/auth/notifications/{notifications.json()[0]['id']}/read"
    ).status_code == 204
    doctor_reactivated = account_client.post(
        f"/api/v1/admin/doctors/{doctor_id}/status",
        json={"status": "active"},
    )
    assert doctor_reactivated.status_code == 200
    assert patient_portal.get("/api/v1/doctors").json()[0]["user_id"] == doctor_id
    removed = account_client.post(
        f"/api/v1/admin/patients/{patient_id}/status",
        json={"status": "removed"},
    )
    assert removed.status_code == 200
    with app.state.test_session() as db:
        assert db.query(UserNotification).filter(UserNotification.user_id == patient_id).count() == 1
        assert db.query(Appointment).count() == 1
        assert db.query(User).filter(User.id == patient_id).one().is_removed


def test_approval_filters_history_pdf_export_and_audit(account_client):
    with app.state.test_session() as db:
        create_account(db, name="Admin", email="admin@example.test", role="admin")
        pending = create_account(
            db, name="Pending Doctor", email="pending@example.test", role="doctor",
            active=False, approval="pending",
        )
        approved = create_account(db, name="Approved Doctor", email="approved@example.test", role="doctor")
        rejected = create_account(
            db, name="Rejected Doctor", email="rejected@example.test", role="doctor",
            active=False, approval="rejected",
        )
        db.add(DoctorProfile(
            user_id=approved.id,
            clinic_name="Care Clinic",
            specialization="Gynecologist",
            city="Mangalore",
            address="Main Road",
            phone="+10000000000",
        ))
        for index in range(8):
            db.add(User(
                full_name=f"Historic Doctor {index}",
                email=f"historic{index}@example.test",
                mobile=f"+1000001{index:04d}",
                hashed_password="unused",
                role="doctor",
                is_active=False,
                approval_status="pending",
                created_at=datetime(2020, 1, index + 1),
            ))
        db.commit()
        pending_id = pending.id
        rejected_id = rejected.id

    authenticate(account_client, "admin@example.test")
    assert account_client.get("/api/v1/admin/doctors").status_code == 200
    assert len(account_client.get(
        "/api/v1/admin/doctors?approval_status=approved&search=Approved&limit=10"
    ).json()) == 1
    for limit, expected in (("10", 10), ("50", 11), ("100", 11), ("all", 11)):
        listed = account_client.get(f"/api/v1/admin/doctors?approval_status=all&limit={limit}")
        assert listed.status_code == 200
        assert len(listed.json()) == expected
    date_filtered = account_client.get(
        "/api/v1/admin/doctors?approval_status=pending&date_from=2020-01-03&date_to=2020-01-07&limit=all"
    )
    assert len(date_filtered.json()) == 5
    counts = account_client.get("/api/v1/admin/doctors/approval-summary")
    assert counts.json() == {"pending": 9, "approved": 1, "rejected": 1}

    decision = account_client.post(
        f"/api/v1/admin/doctors/{pending_id}/decision",
        json={"decision": "approved", "notes": "Credentials verified"},
    )
    assert decision.status_code == 200
    assert decision.json()["is_active"] is True
    details = account_client.get(f"/api/v1/admin/doctors/{pending_id}")
    assert details.status_code == 200
    assert details.json()["approval_history"][0]["decision"] == "approved"
    assert details.json()["approval_decided_at"]
    rejected_response = account_client.post(
        f"/api/v1/admin/doctors/{rejected_id}/decision",
        json={"decision": "rejected", "reason": "Application documents were incomplete."},
    )
    assert rejected_response.status_code == 200
    account_client.cookies.clear()
    rejected_login = account_client.post(
        "/api/v1/auth/login",
        json={"email": "rejected@example.test", "password": "InitialPass9"},
    )
    assert rejected_login.status_code == 403
    assert "Application documents were incomplete." in rejected_login.json()["detail"]
    authenticate(account_client, "admin@example.test")

    pdf = account_client.get(
        "/api/v1/admin/doctors/approval-report.pdf?approval_status=rejected&limit=10"
    )
    assert pdf.status_code == 200
    assert pdf.headers["content-type"] == "application/pdf"
    assert pdf.content.startswith(b"%PDF")
    audit = account_client.get("/api/v1/admin/audit-log")
    assert any(item["action"] == "doctor_approval_decision" for item in audit.json())


def test_additive_account_migration_preserves_existing_user():
    engine = create_engine("sqlite://")
    with engine.begin() as connection:
        connection.execute(text(
            "CREATE TABLE users (id INTEGER PRIMARY KEY, full_name VARCHAR NOT NULL, "
            "email VARCHAR NOT NULL, mobile VARCHAR, hashed_password VARCHAR NOT NULL, "
            "role VARCHAR, preferred_language VARCHAR, created_at DATETIME)"
        ))
        connection.execute(text(
            "INSERT INTO users (id, full_name, email, hashed_password, role) "
            "VALUES (9, 'Existing', 'existing@example.test', 'hash', 'patient')"
        ))
    db = sessionmaker(bind=engine)()
    try:
        ensure_user_schema(db)
        ensure_account_admin_schema(db)
        columns = {column["name"] for column in inspect(engine).get_columns("users")}
        assert {"token_version", "is_removed", "removed_at", "approval_decided_at"} <= columns
        row = db.execute(text("SELECT id, full_name FROM users WHERE id=9")).one()
        assert tuple(row) == (9, "Existing")
    finally:
        db.close()
        engine.dispose()

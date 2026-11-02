import os
import tempfile
os.environ.setdefault("MPLCONFIGDIR", tempfile.gettempdir())

from dataclasses import replace

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core import security
from app.core.config import settings
from app.core.legacy import (
    Appointment,
    DoctorApprovalHistory,
    DoctorProfile,
    User,
    UserNotification,
    hash_password,
    verify_password,
)
from app.database.session import get_db
from app.main import app
from legacy.database import Base


@pytest.fixture
def registration_client(monkeypatch):
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
        replace(settings, secret_key="test-admin-registration-secret-key-32ch"),
    )
    with TestClient(app) as client:
        yield client
    app.dependency_overrides.clear()
    del app.state.test_session
    engine.dispose()


def auth(client, email, token_version=0):
    client.cookies.set(
        security.ACCESS_TOKEN_COOKIE,
        security.create_access_token(email, token_version),
    )


def test_admin_doctor_registration_and_validation(registration_client):
    with app.state.test_session() as db:
        admin = User(
            full_name="Main Admin",
            email="admin@gynocare.test",
            mobile="+10000000001",
            hashed_password=hash_password("AdminPass123"),
            role="admin",
            is_active=True,
            approval_status="approved",
        )
        patient = User(
            full_name="Patient Sarah",
            email="sarah@gynocare.test",
            mobile="+10000000002",
            hashed_password=hash_password("PatientPass123"),
            role="patient",
            is_active=True,
            approval_status="approved",
        )
        db.add_all([admin, patient])
        db.commit()

    # 1. Non-admin cannot register doctors
    auth(registration_client, "sarah@gynocare.test")
    forbidden_resp = registration_client.post(
        "/api/v1/admin/doctors",
        json={
            "full_name": "Dr. Unauth",
            "email": "unauth@gynocare.test",
            "mobile": "+19999999999",
            "medical_reg_no": "REG-UNAUTH",
            "qualification": "MBBS",
            "specialization": "Gynecologist",
            "clinic_name": "Test Clinic",
            "address": "123 Street",
        },
    )
    assert forbidden_resp.status_code == 403

    # Authenticate as admin
    auth(registration_client, "admin@gynocare.test")

    # 2. Register approved and active doctor
    reg_payload = {
        "full_name": "Dr. Sunita Patel",
        "email": "dr.patel@gynocare.test",
        "mobile": "+91 9876543210",
        "gender": "Female",
        "date_of_birth": "1985-06-15",
        "photo_url": "https://example.com/dr_patel.jpg",
        "medical_reg_no": "KMC-2012-99881",
        "qualification": "MBBS, MD (Obstetrics & Gynecology)",
        "specialization": "Gynecologist & PCOS Specialist",
        "years_experience": 12,
        "clinic_name": "Patel Women Care Clinic",
        "city": "Bangalore",
        "address": "100ft Road, Indiranagar",
        "consultation_hours": "Mon–Sat, 10:00 AM – 6:00 PM",
        "consultation_fee": 800,
        "about": "Senior gynecologist with 12 years of clinical experience in PCOS hormonal management.",
        "password": "TemporaryPass123",
        "approval_status": "approved",
        "is_active": True,
        "send_invitation": True,
        "notes": "Verified medical council license and degree certificates.",
    }

    create_resp = registration_client.post("/api/v1/admin/doctors", json=reg_payload)
    assert create_resp.status_code == 201
    doctor_data = create_resp.json()
    assert doctor_data["full_name"] == "Dr. Sunita Patel"
    assert doctor_data["email"] == "dr.patel@gynocare.test"
    assert doctor_data["medical_reg_no"] == "KMC-2012-99881"
    assert doctor_data["qualification"] == "MBBS, MD (Obstetrics & Gynecology)"
    assert doctor_data["consultation_fee"] == 800
    assert doctor_data["is_active"] is True
    assert doctor_data["approval_status"] == "approved"
    assert "password" not in doctor_data
    assert "hashed_password" not in doctor_data

    # 3. Duplicate email rejection
    duplicate_email_resp = registration_client.post(
        "/api/v1/admin/doctors",
        json={
            **reg_payload,
            "email": " DR.PATEL@GYNocare.test ",
            "medical_reg_no": "DIFF-REG-NO",
        },
    )
    assert duplicate_email_resp.status_code == 409
    assert "already exists" in duplicate_email_resp.json()["detail"]

    # 4. Duplicate medical registration number rejection
    duplicate_reg_resp = registration_client.post(
        "/api/v1/admin/doctors",
        json={
            **reg_payload,
            "email": "different.email@gynocare.test",
            "medical_reg_no": "kmc-2012-99881",
        },
    )
    assert duplicate_reg_resp.status_code == 409
    assert "medical registration number already exists" in duplicate_reg_resp.json()["detail"]

    # 5. Verify database records: User and DoctorProfile use the same doctor record (no duplicates)
    with app.state.test_session() as db:
        user_row = db.query(User).filter(User.email == "dr.patel@gynocare.test").one()
        profile_row = db.query(DoctorProfile).filter(DoctorProfile.user_id == user_row.id).one()
        assert profile_row.user_id == user_row.id
        assert profile_row.medical_reg_no == "KMC-2012-99881"
        assert profile_row.qualification == "MBBS, MD (Obstetrics & Gynecology)"
        assert profile_row.consultation_fee == 800
        assert user_row.hashed_password != "TemporaryPass123"
        assert verify_password("TemporaryPass123", user_row.hashed_password)
        notifications = db.query(UserNotification).filter(UserNotification.user_id == user_row.id).all()
        assert len(notifications) >= 1
        history = db.query(DoctorApprovalHistory).filter(DoctorApprovalHistory.doctor_id == user_row.id).all()
        assert len(history) == 1
        assert history[0].decision == "approved"

    # 6. Doctor Login Check: Approved and active doctor can log in
    registration_client.cookies.clear()
    login_resp = registration_client.post(
        "/api/v1/auth/login",
        json={"email": "dr.patel@gynocare.test", "password": "TemporaryPass123"},
    )
    assert login_resp.status_code == 200
    assert login_resp.json()["role"] == "doctor"

    # 7. Patient Doctor Directory Check: Doctor appears in Patient directory
    registration_client.cookies.clear()
    auth(registration_client, "sarah@gynocare.test")
    directory_resp = registration_client.get("/api/v1/doctors")
    assert directory_resp.status_code == 200
    matching_docs = [d for d in directory_resp.json() if d["user_id"] == doctor_data["id"]]
    assert len(matching_docs) == 1
    doc_dir_entry = matching_docs[0]
    assert doc_dir_entry["full_name"] == "Dr. Sunita Patel"
    assert doc_dir_entry["qualification"] == "MBBS, MD (Obstetrics & Gynecology)"
    assert doc_dir_entry["medical_reg_no"] == "KMC-2012-99881"
    assert doc_dir_entry["consultation_fee"] == 800

    # 8. Patient can book an appointment with registered doctor
    booking_resp = registration_client.post(
        "/api/v1/appointments",
        json={
            "doctor_id": doctor_data["id"],
            "appointment_date": "2029-05-10",
            "preferred_time": "11:00",
            "reason": "PCOS symptoms and management",
            "additional_notes": "Initial consultation after diagnosis",
        },
    )
    assert booking_resp.status_code == 201
    appointment_id = booking_resp.json()["id"]

    # 9. Admin Doctor Management Actions: View, Edit, Deactivate, Reactivate, Reset Password, Safe Soft Deletion
    registration_client.cookies.clear()
    auth(registration_client, "admin@gynocare.test")

    # View full doctor details
    details_resp = registration_client.get(f"/api/v1/admin/doctors/{doctor_data['id']}")
    assert details_resp.status_code == 200
    details = details_resp.json()
    assert details["doctor_profile"]["medical_reg_no"] == "KMC-2012-99881"
    assert len(details["appointments"]) == 1
    assert details["appointments"][0]["id"] == appointment_id

    # Edit doctor details
    edit_resp = registration_client.put(
        f"/api/v1/admin/doctors/{doctor_data['id']}",
        json={
            "qualification": "MBBS, MD, Fellowship in Reproductive Medicine",
            "consultation_fee": 1000,
            "clinic_name": "Patel Advanced Women Care Center",
            "admin_notes": "Added fellowship credentials",
        },
    )
    assert edit_resp.status_code == 200
    assert edit_resp.json()["qualification"] == "MBBS, MD, Fellowship in Reproductive Medicine"
    assert edit_resp.json()["consultation_fee"] == 1000
    assert edit_resp.json()["clinic_name"] == "Patel Advanced Women Care Center"

    # Reset Password / Send Account Invitation
    reset_resp = registration_client.post(
        f"/api/v1/admin/doctors/{doctor_data['id']}/reset-password",
        json={"new_password": "NewSecurePassword456", "send_invitation": True},
    )
    assert reset_resp.status_code == 200
    assert reset_resp.json()["status"] == "success"
    assert "NewSecurePassword456" not in reset_resp.text

    # Login with old password fails, new password succeeds
    registration_client.cookies.clear()
    stale_login = registration_client.post(
        "/api/v1/auth/login",
        json={"email": "dr.patel@gynocare.test", "password": "TemporaryPass123"},
    )
    assert stale_login.status_code == 401

    new_login = registration_client.post(
        "/api/v1/auth/login",
        json={"email": "dr.patel@gynocare.test", "password": "NewSecurePassword456"},
    )
    assert new_login.status_code == 200

    # Deactivate doctor
    registration_client.cookies.clear()
    auth(registration_client, "admin@gynocare.test")
    deact_resp = registration_client.post(
        f"/api/v1/admin/doctors/{doctor_data['id']}/status",
        json={"status": "inactive", "reason": "Sabbatical leave"},
    )
    assert deact_resp.status_code == 200
    assert deact_resp.json()["is_active"] is False

    # Deactivated doctor cannot log in
    registration_client.cookies.clear()
    deact_login = registration_client.post(
        "/api/v1/auth/login",
        json={"email": "dr.patel@gynocare.test", "password": "NewSecurePassword456"},
    )
    assert deact_login.status_code == 403
    assert "inactive" in deact_login.json()["detail"].lower()

    # Deactivated doctor does not appear in patient directory
    registration_client.cookies.clear()
    auth(registration_client, "sarah@gynocare.test")
    assert not any(d["user_id"] == doctor_data["id"] for d in registration_client.get("/api/v1/doctors").json())

    # Reactivate doctor
    registration_client.cookies.clear()
    auth(registration_client, "admin@gynocare.test")
    react_resp = registration_client.post(
        f"/api/v1/admin/doctors/{doctor_data['id']}/status",
        json={"status": "active"},
    )
    assert react_resp.status_code == 200
    assert react_resp.json()["is_active"] is True

    # Safe soft removal
    remove_resp = registration_client.delete(f"/api/v1/admin/doctors/{doctor_data['id']}")
    assert remove_resp.status_code == 200
    assert remove_resp.json()["is_removed"] is True

    # Existing appointment history remains intact in DB!
    with app.state.test_session() as db:
        persisted_appointment = db.query(Appointment).filter(Appointment.id == appointment_id).first()
        assert persisted_appointment is not None
        assert persisted_appointment.doctor_id == doctor_data["id"]


def test_doctor_registered_as_pending_approval(registration_client):
    with app.state.test_session() as db:
        admin = User(
            full_name="Admin Boss",
            email="admin.boss@gynocare.test",
            hashed_password=hash_password("AdminPass123"),
            role="admin",
            is_active=True,
            approval_status="approved",
        )
        db.add(admin)
        db.commit()

    auth(registration_client, "admin.boss@gynocare.test")

    # Register doctor with approval_status="pending"
    pending_resp = registration_client.post(
        "/api/v1/admin/doctors",
        json={
            "full_name": "Dr. Pending Review",
            "email": "pending.doc@gynocare.test",
            "mobile": "+91 9999911111",
            "medical_reg_no": "PENDING-REG-001",
            "qualification": "MBBS",
            "specialization": "Dermatologist",
            "clinic_name": "Skin & Hormones",
            "city": "Bangalore",
            "address": "45 MG Road",
            "password": "PendingPass123",
        },
    )
    assert pending_resp.status_code == 201
    doctor_id = pending_resp.json()["id"]
    assert pending_resp.json()["approval_status"] == "pending"
    assert pending_resp.json()["is_active"] is False

    # Pending doctor cannot log in
    registration_client.cookies.clear()
    login_resp = registration_client.post(
        "/api/v1/auth/login",
        json={"email": "pending.doc@gynocare.test", "password": "PendingPass123"},
    )
    assert login_resp.status_code == 403
    assert "pending Admin approval" in login_resp.json()["detail"]

    # Pending doctor does not appear in public doctor directory
    auth(registration_client, "admin.boss@gynocare.test")
    doctors_pub = registration_client.get("/api/v1/doctors").json()
    assert not any(d["user_id"] == doctor_id for d in doctors_pub)

    # Appears in admin pending approvals
    pending_approvals = registration_client.get("/api/v1/admin/doctors?approval_status=pending").json()
    assert any(d["id"] == doctor_id for d in pending_approvals)

    # Admin approves the doctor
    decision_resp = registration_client.post(
        f"/api/v1/admin/doctors/{doctor_id}/decision",
        json={"decision": "approved", "notes": "Licenses verified with medical council"},
    )
    assert decision_resp.status_code == 200
    assert decision_resp.json()["approval_status"] == "approved"
    assert decision_resp.json()["is_active"] is True

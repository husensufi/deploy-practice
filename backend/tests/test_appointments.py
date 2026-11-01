from dataclasses import replace
from datetime import date, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.admin import ensure_appointment_schema, ensure_doctor_profile_schema
from app.core import security
from app.core.config import settings
from app.database.session import get_db
from app.main import app
from legacy.database import Base
from legacy.models import User
from legacy.models_doctor import DoctorProfile


@pytest.fixture
def appointment_app(monkeypatch):
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
    monkeypatch.setattr(
        security,
        "settings",
        replace(settings, secret_key="appointment-tests-secret-key-long"),
    )
    monkeypatch.setattr("app.main.SessionLocal", test_session)
    with TestClient(app) as client:
        yield client, test_session
    app.dependency_overrides.clear()
    engine.dispose()


def add_user(session_factory, *, name: str, email: str, role: str, approved: bool = True) -> User:
    with session_factory() as db:
        user = User(
            full_name=name,
            email=email,
            mobile=f"+1{abs(hash(email)) % 10**10:010d}",
            hashed_password="test-hash",
            role=role,
            is_active=approved,
            approval_status="approved" if approved else "pending",
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        return user


def add_doctor_profile(session_factory, user_id: int) -> None:
    with session_factory() as db:
        db.add(
            DoctorProfile(
                user_id=user_id,
                clinic_name="GynoCare Clinic",
                specialization="Gynecologist",
                city="Test City",
                address="1 Test Road",
                phone="+10000000000",
                consultation_hours="Mon-Sat, 10 AM-6 PM",
            )
        )
        db.commit()


def sign_in(client: TestClient, user: User) -> None:
    client.cookies.set(
        security.ACCESS_TOKEN_COOKIE,
        security.create_access_token(user.email, getattr(user, "token_version", 0)),
    )


def booking_payload(doctor_id: int, *, day_offset: int = 2, preferred_time: str = "10:30") -> dict:
    return {
        "doctor_id": doctor_id,
        "appointment_date": (date.today() + timedelta(days=day_offset)).isoformat(),
        "preferred_time": preferred_time,
        "reason": "Discuss recent cycle changes",
    }


def test_approved_doctor_booking_decision_completion_and_admin_monitoring(appointment_app) -> None:
    client, session_factory = appointment_app
    admin = add_user(session_factory, name="Admin", email="admin@example.test", role="admin")
    doctor = add_user(
        session_factory,
        name="Doctor",
        email="doctor@example.test",
        role="doctor",
        approved=False,
    )
    patient = add_user(session_factory, name="Patient", email="patient@example.test", role="patient")
    add_doctor_profile(session_factory, doctor.id)

    sign_in(client, admin)
    approved = client.post(
        f"/api/v1/admin/doctors/{doctor.id}/decision",
        json={"decision": "approved"},
    )
    assert approved.status_code == 200
    assert approved.json()["approval_status"] == "approved"
    doctor.token_version += 1

    sign_in(client, patient)
    directory = client.get("/api/v1/doctors")
    assert directory.status_code == 200
    assert len(directory.json()) == 1
    assert directory.json()[0]["user_id"] == doctor.id

    payload = booking_payload(doctor.id)
    payload["additional_notes"] = "Cycles have been irregular recently."
    request = client.post("/api/v1/appointments", json=payload)
    assert request.status_code == 201
    appointment_id = request.json()["id"]
    assert request.json()["status"] == "pending"
    assert request.json()["patient_name"] == "Patient"
    assert request.json()["reason"] == payload["reason"]
    assert request.json()["additional_notes"] == payload["additional_notes"]

    duplicate = client.post("/api/v1/appointments", json=booking_payload(doctor.id))
    assert duplicate.status_code == 409
    assert client.get("/api/v1/admin/appointments").status_code == 403

    sign_in(client, doctor)
    incoming = client.get("/api/v1/doctor/appointments")
    assert incoming.status_code == 200
    assert len(incoming.json()) == 1
    assert incoming.json()[0]["patient_email"] == patient.email
    accepted = client.post(
        f"/api/v1/doctor/appointments/{appointment_id}/decision",
        json={"decision": "accepted", "note": "Please bring your recent cycle records."},
    )
    assert accepted.status_code == 200
    assert accepted.json()["status"] == "accepted"
    assert accepted.json()["doctor_note"] == "Please bring your recent cycle records."

    sign_in(client, patient)
    patient_appointments = client.get("/api/v1/appointments")
    assert patient_appointments.status_code == 200
    assert patient_appointments.json()[0]["status"] == "accepted"
    assert patient_appointments.json()[0]["doctor_note"] == "Please bring your recent cycle records."
    cancellable_booking = client.post(
        "/api/v1/appointments",
        json=booking_payload(doctor.id, preferred_time="12:30"),
    )
    assert cancellable_booking.status_code == 201
    sign_in(client, doctor)
    accepted_cancellable = client.post(
        f"/api/v1/doctor/appointments/{cancellable_booking.json()['id']}/decision",
        json={"decision": "accepted"},
    )
    assert accepted_cancellable.status_code == 200
    sign_in(client, patient)
    cancelled_accepted = client.post(
        f"/api/v1/appointments/{cancellable_booking.json()['id']}/cancel"
    )
    assert cancelled_accepted.status_code == 200
    assert cancelled_accepted.json()["status"] == "cancelled"

    sign_in(client, doctor)
    completed = client.post(
        f"/api/v1/doctor/appointments/{appointment_id}/complete",
        json={"note": "Follow-up recommended."},
    )
    assert completed.status_code == 200
    assert completed.json()["status"] == "completed"
    assert completed.json()["doctor_note"] == "Follow-up recommended."

    sign_in(client, admin)
    monitored = client.get(
        "/api/v1/admin/appointments",
        params={
            "doctor_id": doctor.id,
            "patient_id": patient.id,
            "status": "completed",
            "date_from": payload["appointment_date"],
            "date_to": payload["appointment_date"],
        },
    )
    assert monitored.status_code == 200
    assert [item["id"] for item in monitored.json()] == [appointment_id]
    dashboard = client.get("/api/v1/admin/dashboard")
    assert dashboard.status_code == 200
    assert dashboard.json()["total_appointments"] == 2
    assert dashboard.json()["completed_appointments"] == 1
    assert appointment_id in [item["id"] for item in dashboard.json()["recent_appointment_activity"]]


def test_cancel_reject_ownership_validation_and_doctor_approval(appointment_app) -> None:
    client, session_factory = appointment_app
    doctor = add_user(session_factory, name="Doctor", email="doctor@example.test", role="doctor")
    other_doctor = add_user(session_factory, name="Other Doctor", email="other@example.test", role="doctor")
    pending_doctor = add_user(
        session_factory,
        name="Pending Doctor",
        email="pending@example.test",
        role="doctor",
        approved=False,
    )
    patient = add_user(session_factory, name="Patient", email="patient@example.test", role="patient")
    other_patient = add_user(session_factory, name="Other Patient", email="other-patient@example.test", role="patient")
    add_doctor_profile(session_factory, doctor.id)
    add_doctor_profile(session_factory, other_doctor.id)
    add_doctor_profile(session_factory, pending_doctor.id)

    sign_in(client, patient)
    assert client.post("/api/v1/appointments", json=booking_payload(pending_doctor.id)).status_code == 404
    first = client.post("/api/v1/appointments", json=booking_payload(doctor.id, preferred_time="11:00"))
    assert first.status_code == 201
    appointment_id = first.json()["id"]

    sign_in(client, other_patient)
    assert client.post(f"/api/v1/appointments/{appointment_id}/cancel").status_code == 404

    sign_in(client, other_doctor)
    assert client.get("/api/v1/doctor/appointments").json() == []
    assert client.post(
        f"/api/v1/doctor/appointments/{appointment_id}/decision",
        json={"decision": "accepted"},
    ).status_code == 404

    sign_in(client, patient)
    cancelled = client.post(f"/api/v1/appointments/{appointment_id}/cancel")
    assert cancelled.status_code == 200
    assert cancelled.json()["status"] == "cancelled"
    reused_slot = client.post("/api/v1/appointments", json=booking_payload(doctor.id, preferred_time="11:00"))
    assert reused_slot.status_code == 201

    sign_in(client, doctor)
    rejected = client.post(
        f"/api/v1/doctor/appointments/{reused_slot.json()['id']}/decision",
        json={"decision": "rejected", "note": "Please choose another clinic time."},
    )
    assert rejected.status_code == 200
    assert rejected.json()["status"] == "rejected"
    assert rejected.json()["doctor_note"] == "Please choose another clinic time."
    assert client.post(
        f"/api/v1/doctor/appointments/{reused_slot.json()['id']}/complete"
    ).status_code == 409

    sign_in(client, patient)
    invalid_time = client.post(
        "/api/v1/appointments",
        json={**booking_payload(doctor.id, preferred_time="not-a-time"), "preferred_time": "not-a-time"},
    )
    past_date = client.post(
        "/api/v1/appointments",
        json={
            **booking_payload(doctor.id),
            "appointment_date": (date.today() - timedelta(days=1)).isoformat(),
        },
    )
    long_notes = client.post(
        "/api/v1/appointments",
        json={
            **booking_payload(doctor.id),
            "additional_notes": "x" * 501,
        },
    )
    assert invalid_time.status_code == 422
    assert past_date.status_code == 422
    assert long_notes.status_code == 422


def test_admin_can_cancel_problematic_pending_booking(appointment_app) -> None:
    client, session_factory = appointment_app
    admin = add_user(session_factory, name="Admin", email="admin@example.test", role="admin")
    doctor = add_user(session_factory, name="Doctor", email="doctor@example.test", role="doctor")
    patient = add_user(session_factory, name="Patient", email="patient@example.test", role="patient")
    add_doctor_profile(session_factory, doctor.id)

    sign_in(client, patient)
    booking = client.post("/api/v1/appointments", json=booking_payload(doctor.id))
    assert booking.status_code == 201
    appointment_id = booking.json()["id"]

    sign_in(client, admin)
    cancelled = client.post(
        f"/api/v1/admin/appointments/{appointment_id}/cancel",
        json={"note": "Duplicate booking reported by the patient."},
    )
    assert cancelled.status_code == 200
    assert cancelled.json()["status"] == "cancelled"
    assert cancelled.json()["admin_note"] == "Duplicate booking reported by the patient."


def test_patient_and_doctor_reschedule_proposals_require_other_party_response(appointment_app) -> None:
    client, session_factory = appointment_app
    doctor = add_user(session_factory, name="Doctor", email="doctor@example.test", role="doctor")
    patient = add_user(session_factory, name="Patient", email="patient@example.test", role="patient")
    add_doctor_profile(session_factory, doctor.id)

    sign_in(client, patient)
    requested = client.post("/api/v1/appointments", json=booking_payload(doctor.id))
    appointment_id = requested.json()["id"]
    assert requested.status_code == 201

    sign_in(client, doctor)
    accepted = client.post(
        f"/api/v1/doctor/appointments/{appointment_id}/decision",
        json={"decision": "accepted"},
    )
    assert accepted.status_code == 200

    sign_in(client, patient)
    proposed = client.post(
        f"/api/v1/appointments/{appointment_id}/reschedule",
        json={
            "appointment_date": (date.today() + timedelta(days=5)).isoformat(),
            "preferred_time": "13:15",
            "note": "I need an afternoon time.",
        },
    )
    assert proposed.status_code == 200
    assert proposed.json()["status"] == "rescheduled"
    assert proposed.json()["reschedule_requested_by"] == "patient"
    assert proposed.json()["reschedule_time"] == "13:15"
    assert client.post(
        f"/api/v1/appointments/{appointment_id}/reschedule",
        json={
            "appointment_date": (date.today() + timedelta(days=6)).isoformat(),
            "preferred_time": "13:15",
        },
    ).status_code == 409

    sign_in(client, doctor)
    confirmed = client.post(
        f"/api/v1/doctor/appointments/{appointment_id}/reschedule-decision",
        json={"decision": "accepted", "note": "Confirmed for the afternoon."},
    )
    assert confirmed.status_code == 200
    assert confirmed.json()["status"] == "accepted"
    assert confirmed.json()["appointment_date"] == (date.today() + timedelta(days=5)).isoformat()
    assert confirmed.json()["doctor_note"] == "Confirmed for the afternoon."

    doctor_proposal = client.post(
        f"/api/v1/doctor/appointments/{appointment_id}/reschedule",
        json={
            "appointment_date": (date.today() + timedelta(days=8)).isoformat(),
            "preferred_time": "16:00",
            "note": "Clinic hours changed.",
        },
    )
    assert doctor_proposal.status_code == 200
    assert doctor_proposal.json()["reschedule_requested_by"] == "doctor"

    sign_in(client, patient)
    final = client.post(
        f"/api/v1/appointments/{appointment_id}/reschedule-decision",
        json={"decision": "accepted"},
    )
    assert final.status_code == 200
    assert final.json()["status"] == "accepted"
    assert final.json()["appointment_date"] == (date.today() + timedelta(days=8)).isoformat()
    assert final.json()["preferred_time"] == "16:00"

    sign_in(client, doctor)
    next_proposal = client.post(
        f"/api/v1/doctor/appointments/{appointment_id}/reschedule",
        json={
            "appointment_date": (date.today() + timedelta(days=10)).isoformat(),
            "preferred_time": "17:00",
        },
    )
    assert next_proposal.status_code == 200
    sign_in(client, patient)
    assert client.post(
        f"/api/v1/appointments/{appointment_id}/reschedule-decision",
        json={"decision": "rejected"},
    ).status_code == 422
    declined = client.post(
        f"/api/v1/appointments/{appointment_id}/reschedule-decision",
        json={"decision": "rejected", "note": "That time does not work for me."},
    )
    assert declined.status_code == 200
    assert declined.json()["status"] == "accepted"
    assert declined.json()["doctor_note"] == "That time does not work for me."


def test_inactive_doctor_reassignment_is_admin_managed(appointment_app) -> None:
    client, session_factory = appointment_app
    admin = add_user(session_factory, name="Admin", email="admin@example.test", role="admin")
    doctor = add_user(session_factory, name="Doctor", email="doctor@example.test", role="doctor")
    replacement = add_user(session_factory, name="Replacement", email="replacement@example.test", role="doctor")
    patient = add_user(session_factory, name="Patient", email="patient@example.test", role="patient")
    add_doctor_profile(session_factory, doctor.id)
    add_doctor_profile(session_factory, replacement.id)

    sign_in(client, patient)
    booking = client.post("/api/v1/appointments", json=booking_payload(doctor.id))
    assert booking.status_code == 201
    appointment_id = booking.json()["id"]

    with session_factory() as db:
        original_doctor = db.query(User).filter(User.id == doctor.id).one()
        original_doctor.is_active = False
        db.commit()

    inactive_appointment = client.get("/api/v1/appointments").json()[0]
    assert inactive_appointment["doctor_active"] is False
    reassignment_request = client.post(
        f"/api/v1/appointments/{appointment_id}/reassignment",
        json={"note": "My doctor is no longer available."},
    )
    assert reassignment_request.status_code == 200
    assert reassignment_request.json()["reassignment_requested"] is True
    assert client.post(
        f"/api/v1/admin/appointments/{appointment_id}/reassign",
        json={"doctor_id": replacement.id, "note": "Assigned to the next available doctor."},
    ).status_code == 403

    sign_in(client, admin)
    reassigned = client.post(
        f"/api/v1/admin/appointments/{appointment_id}/reassign",
        json={"doctor_id": replacement.id, "note": "Assigned to the next available doctor."},
    )
    assert reassigned.status_code == 200
    assert reassigned.json()["doctor_id"] == replacement.id
    assert reassigned.json()["status"] == "pending"
    assert reassigned.json()["reassignment_requested"] is False
    assert reassigned.json()["admin_note"] == "Assigned to the next available doctor."


def test_additive_schema_updates_preserve_existing_appointment_and_doctor_rows() -> None:
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    with engine.begin() as connection:
        connection.exec_driver_sql(
            """
            CREATE TABLE appointments (
                id INTEGER PRIMARY KEY,
                patient_id INTEGER NOT NULL,
                doctor_id INTEGER NOT NULL,
                appointment_date DATE NOT NULL,
                preferred_time VARCHAR(5) NOT NULL,
                reason TEXT NOT NULL,
                status VARCHAR(20) NOT NULL,
                doctor_note TEXT,
                admin_note TEXT,
                created_at DATETIME NOT NULL,
                updated_at DATETIME NOT NULL
            )
            """
        )
        connection.exec_driver_sql(
            """
            INSERT INTO appointments
                (id, patient_id, doctor_id, appointment_date, preferred_time, reason,
                 status, created_at, updated_at)
            VALUES (41, 5, 21, '2027-01-12', '10:30', 'Existing appointment',
                    'pending', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            """
        )
        connection.exec_driver_sql(
            """
            CREATE TABLE doctor_profiles (
                id INTEGER PRIMARY KEY,
                user_id INTEGER NOT NULL,
                clinic_name VARCHAR NOT NULL,
                specialization VARCHAR,
                city VARCHAR NOT NULL,
                address VARCHAR NOT NULL,
                phone VARCHAR NOT NULL,
                consultation_hours VARCHAR,
                about TEXT,
                photo_url VARCHAR,
                updated_at DATETIME
            )
            """
        )
        connection.exec_driver_sql(
            """
            INSERT INTO doctor_profiles
                (id, user_id, clinic_name, city, address, phone)
            VALUES (8, 21, 'Existing Clinic', 'Mangalore', 'Existing Road', '+10000000000')
            """
        )

    session_factory = sessionmaker(bind=engine, autoflush=False)
    with session_factory() as db:
        ensure_appointment_schema(db)
        ensure_doctor_profile_schema(db)
        appointment = db.execute(
            text("SELECT id, reason, additional_notes FROM appointments WHERE id = 41")
        ).one()
        profile = db.execute(
            text("SELECT id, clinic_name, years_experience FROM doctor_profiles WHERE id = 8")
        ).one()

    assert appointment == (41, "Existing appointment", None)
    assert profile == (8, "Existing Clinic", None)
    engine.dispose()

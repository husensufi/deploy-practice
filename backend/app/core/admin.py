import os

from sqlalchemy import inspect, text
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.legacy import (
    AdminAuditLog,
    Appointment,
    DoctorProfile,
    DoctorApprovalHistory,
    User,
    UserNotification,
    hash_password,
    verify_password,
)


def ensure_user_schema(db: Session) -> None:
    """Add admin and approval columns when the existing SQLite schema is older."""
    inspector = inspect(db.bind)
    if not inspector.has_table("users"):
        return

    columns = {column["name"] for column in inspector.get_columns("users")}
    additions = [
        ("is_active", "BOOLEAN NOT NULL DEFAULT 1"),
        ("approval_status", "VARCHAR DEFAULT 'approved'"),
        ("rejection_reason", "TEXT"),
        ("admin_notes", "TEXT"),
        ("updated_at", "DATETIME"),
        ("approval_decided_at", "DATETIME"),
        ("token_version", "INTEGER NOT NULL DEFAULT 0"),
        ("is_removed", "BOOLEAN NOT NULL DEFAULT 0"),
        ("removed_at", "DATETIME"),
    ]

    for column_name, ddl in additions:
        if column_name not in columns:
            db.execute(text(f"ALTER TABLE users ADD COLUMN {column_name} {ddl}"))
    db.commit()


def ensure_appointment_schema(db: Session) -> None:
    """Add appointment workflow columns/index without replacing existing records."""
    Appointment.__table__.create(bind=db.get_bind(), checkfirst=True)
    inspector = inspect(db.bind)
    columns = {column["name"] for column in inspector.get_columns("appointments")}
    additions = [
        ("additional_notes", "VARCHAR(500)"),
        ("reschedule_date", "DATE"),
        ("reschedule_time", "VARCHAR(5)"),
        ("reschedule_requested_by", "VARCHAR(20)"),
        ("reassignment_requested", "BOOLEAN NOT NULL DEFAULT 0"),
    ]
    for column_name, ddl in additions:
        if column_name not in columns:
            db.execute(text(f"ALTER TABLE appointments ADD COLUMN {column_name} {ddl}"))

    db.execute(text("DROP INDEX IF EXISTS uq_appointments_doctor_slot_active"))
    db.execute(
        text(
            "CREATE UNIQUE INDEX uq_appointments_doctor_slot_active "
            "ON appointments (doctor_id, appointment_date, preferred_time) "
            "WHERE status IN ('pending', 'accepted', 'rescheduled')"
        )
    )
    db.commit()


def ensure_doctor_profile_schema(db: Session) -> None:
    """Add profile data fields used by the patient-facing doctor directory."""
    inspector = inspect(db.bind)
    if not inspector.has_table("doctor_profiles"):
        return

    columns = {column["name"] for column in inspector.get_columns("doctor_profiles")}
    if "years_experience" not in columns:
        db.execute(text("ALTER TABLE doctor_profiles ADD COLUMN years_experience INTEGER"))
    db.commit()


def ensure_account_admin_schema(db: Session) -> None:
    """Apply additive account-state columns and create audit/notification tables."""
    inspector = inspect(db.bind)
    AdminAuditLog.__table__.create(bind=db.get_bind(), checkfirst=True)
    DoctorApprovalHistory.__table__.create(bind=db.get_bind(), checkfirst=True)
    UserNotification.__table__.create(bind=db.get_bind(), checkfirst=True)
    db.commit()


def seed_admin_account(db: Session) -> User | None:
    """Create the initial administrator account from environment variables."""
    ensure_user_schema(db)

    email = (os.getenv("ADMIN_EMAIL") or settings.admin_email or "").strip().lower()
    password = os.getenv("ADMIN_PASSWORD") or settings.admin_password or ""
    if not email or not password:
        return None

    existing = db.query(User).filter(User.email == email).first()
    if existing:
        changed = False
        if existing.role != "admin":
            existing.role = "admin"
            changed = True
        if not existing.is_active:
            existing.is_active = True
            changed = True
        if existing.approval_status != "approved":
            existing.approval_status = "approved"
            changed = True
        if not verify_password(password, existing.hashed_password):
            existing.hashed_password = hash_password(password)
            changed = True
        if changed:
            db.commit()
        return existing

    admin = User(
        full_name="Platform Administrator",
        email=email,
        mobile=None,
        hashed_password=hash_password(password),
        role="admin",
        preferred_language="en",
        is_active=True,
        approval_status="approved",
    )
    db.add(admin)
    db.commit()
    db.refresh(admin)
    return admin

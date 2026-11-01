import os

from sqlalchemy import inspect, text
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.legacy import Appointment, User, hash_password


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


def seed_admin_account(db: Session) -> User | None:
    """Create the initial administrator account from environment variables."""
    ensure_user_schema(db)

    email = (os.getenv("ADMIN_EMAIL") or settings.admin_email or "").strip().lower()
    password = os.getenv("ADMIN_PASSWORD") or settings.admin_password or ""
    if not email or not password:
        return None

    existing = db.query(User).filter(User.email == email).first()
    if existing:
        if existing.role != "admin":
            existing.role = "admin"
            existing.is_active = True
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

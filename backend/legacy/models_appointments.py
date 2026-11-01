from datetime import datetime

from sqlalchemy import Boolean, Column, Date, DateTime, ForeignKey, Index, Integer, String, Text, text

from .database import Base


class Appointment(Base):
    __tablename__ = "appointments"
    __table_args__ = (
        Index(
            "uq_appointments_doctor_slot_active",
            "doctor_id",
            "appointment_date",
            "preferred_time",
            unique=True,
            sqlite_where=text("status IN ('pending', 'accepted', 'rescheduled')"),
        ),
    )

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    doctor_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    appointment_date = Column(Date, nullable=False, index=True)
    preferred_time = Column(String(5), nullable=False)
    reason = Column(Text, nullable=False)
    additional_notes = Column(String(500), nullable=True)
    status = Column(String(20), nullable=False, default="pending", index=True)
    doctor_note = Column(Text, nullable=True)
    admin_note = Column(Text, nullable=True)
    reschedule_date = Column(Date, nullable=True)
    reschedule_time = Column(String(5), nullable=True)
    reschedule_requested_by = Column(String(20), nullable=True)
    reassignment_requested = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

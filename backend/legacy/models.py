"""
models.py
---------
Every class here becomes a TABLE in the database.
This is the only file (in Part 1) that defines what a "User" is.

In Part 2 we will add: DailyLog, PCOSAssessment, DoctorProfile, etc.
in a new file called models_tracker.py so this file doesn't get messy.
"""

from sqlalchemy import Boolean, Column, Integer, String, DateTime, Text
from datetime import datetime
from .database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    mobile = Column(String, unique=True, index=True, nullable=True)

    # We NEVER store the real password. Only its hashed (scrambled) version.
    hashed_password = Column(String, nullable=False)

    # "patient", "doctor", or "admin" — decides which dashboard the user sees.
    role = Column(String, default="patient")
    is_active = Column(Boolean, default=True, nullable=False)
    approval_status = Column(String, default="approved")
    rejection_reason = Column(Text, nullable=True)
    admin_notes = Column(Text, nullable=True)
    approval_decided_at = Column(DateTime, nullable=True)
    token_version = Column(Integer, default=0, nullable=False)
    is_removed = Column(Boolean, default=False, nullable=False)
    removed_at = Column(DateTime, nullable=True)

    # Preferred language: "en", "hi", or "kn"
    preferred_language = Column(String, default="en")
    gender = Column(String, nullable=True)
    date_of_birth = Column(String, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

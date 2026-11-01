"""
models_doctor.py
-----------------
One table: DoctorProfile. A user who signed up with role="doctor"
(see models.py / the signup form's "I am a" toggle) can fill this in
once to appear in the public Doctors directory that patients browse.
"""

from sqlalchemy import Column, Integer, String, Text, ForeignKey, DateTime
from datetime import datetime
from database import Base


class DoctorProfile(Base):
    __tablename__ = "doctor_profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)

    clinic_name = Column(String, nullable=False)
    specialization = Column(String, default="Gynecologist")
    city = Column(String, nullable=False)
    address = Column(String, nullable=False)
    phone = Column(String, nullable=False)
    consultation_hours = Column(String, default="Mon–Sat, 10 AM – 6 PM")
    about = Column(Text, nullable=True)
    photo_url = Column(String, nullable=True)  # optional; a placeholder is shown if empty

    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

"""
models_tracker.py
------------------
Part 2 adds TWO new tables. Kept in a separate file from models.py so
the project stays organised as it grows (you'll thank yourself later).

1. PCOSProfile
   - Filled ONCE (editable any time), like a medical intake form.
   - Holds the clinical-style fields used for the risk screening:
     age, height, weight, cycle regularity, hirsutism, acne, etc.
   - One profile per user (one-to-one).

2. DailyLog
   - Filled EVERY DAY (many rows per user, one per date).
   - Holds day-to-day habit data: period flag, cramp pain, water,
     exercise, sleep, mood, junk food, notes.
   - This is what your matplotlib/seaborn charts in Part 3 will read.
"""

from sqlalchemy import Column, Integer, Float, String, Boolean, Date, DateTime, ForeignKey, Text
from datetime import datetime
from .database import Base


class PCOSProfile(Base):
    __tablename__ = "pcos_profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)

    age = Column(Integer, nullable=False)
    height_cm = Column(Float, nullable=False)
    weight_kg = Column(Float, nullable=False)

    cycle_regularity = Column(String, default="regular")   # "regular" | "irregular"
    avg_cycle_length_days = Column(Integer, nullable=True)

    # Clinical screening flags (all boolean yes/no)
    excessive_hair_growth = Column(Boolean, default=False)   # hirsutism
    acne = Column(Boolean, default=False)
    hair_thinning = Column(Boolean, default=False)
    skin_darkening = Column(Boolean, default=False)           # acanthosis nigricans (neck/underarm)
    weight_gain_difficulty = Column(Boolean, default=False)   # trouble losing weight
    family_history_pcos = Column(Boolean, default=False)
    mood_swings = Column(Boolean, default=False)

    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class DailyLog(Base):
    __tablename__ = "daily_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    log_date = Column(Date, nullable=False)

    on_period = Column(Boolean, default=False)
    cramp_pain_level = Column(Integer, default=0)      # 0 (none) to 10 (severe)
    water_intake_liters = Column(Float, default=0.0)
    exercise_minutes = Column(Integer, default=0)
    sleep_hours = Column(Float, default=0.0)
    mood = Column(String, default="normal")            # happy | normal | irritated | sad | anxious
    junk_food = Column(Boolean, default=False)
    notes = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)

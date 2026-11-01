from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.auth import UserResponse


class PCOSProfileResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    age: int
    height_cm: float
    weight_kg: float
    cycle_regularity: str
    avg_cycle_length_days: int | None
    excessive_hair_growth: bool
    acne: bool
    hair_thinning: bool
    skin_darkening: bool
    weight_gain_difficulty: bool
    family_history_pcos: bool
    mood_swings: bool
    updated_at: datetime | None


class AssessmentSubmitRequest(BaseModel):
    age: int = Field(ge=10, le=70)
    height_cm: float = Field(gt=0, le=300)
    weight_kg: float = Field(gt=0, le=500)
    cycle_regularity: Literal["regular", "irregular"]
    avg_cycle_length_days: int | None = Field(default=None, ge=1, le=365)
    excessive_hair_growth: bool = False
    acne: bool = False
    hair_thinning: bool = False
    skin_darkening: bool = False
    weight_gain_difficulty: bool = False
    family_history_pcos: bool = False
    mood_swings: bool = False


class ScreeningResultResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    score: int
    max_score: int
    risk_level: Literal["Low", "Moderate", "High"]
    bmi: float
    message: str
    ml_probability: float | None = None


class AssessmentResponse(BaseModel):
    profile: PCOSProfileResponse
    result: ScreeningResultResponse


class DailyLogSubmitRequest(BaseModel):
    on_period: bool = False
    cramp_pain_level: int = Field(default=0, ge=0, le=10)
    water_intake_liters: float = Field(default=0.0, ge=0, le=100)
    exercise_minutes: int = Field(default=0, ge=0, le=1440)
    sleep_hours: float = Field(default=0.0, ge=0, le=24)
    mood: Literal["happy", "normal", "irritated", "sad", "anxious"] = "normal"
    junk_food: bool = False
    notes: str = Field(default="", max_length=5000)


class DailyLogResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    log_date: date
    on_period: bool
    cramp_pain_level: int
    water_intake_liters: float
    exercise_minutes: int
    sleep_hours: float
    mood: str
    junk_food: bool
    notes: str | None
    created_at: datetime | None


class TrackerSummaryResponse(BaseModel):
    today_date: date
    total_entries: int
    latest_entry: DailyLogResponse | None
    today_entry: DailyLogResponse | None


class PatientDashboardResponse(BaseModel):
    user: UserResponse
    profile: PCOSProfileResponse | None
    screening_result: ScreeningResultResponse | None
    today_log: DailyLogResponse | None
    recent_logs: list[DailyLogResponse]

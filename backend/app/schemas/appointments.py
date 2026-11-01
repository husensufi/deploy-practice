from datetime import date, datetime, time
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


AppointmentStatus = Literal["pending", "accepted", "rejected", "cancelled", "completed", "rescheduled"]


class AppointmentCreateRequest(BaseModel):
    doctor_id: int = Field(gt=0)
    appointment_date: date
    preferred_time: str
    reason: str = Field(min_length=3, max_length=3000)
    additional_notes: str | None = Field(default=None, max_length=500)

    @field_validator("appointment_date")
    @classmethod
    def require_future_date(cls, value: date) -> date:
        if value < date.today():
            raise ValueError("Appointment date cannot be in the past.")
        return value

    @field_validator("preferred_time")
    @classmethod
    def normalize_time(cls, value: str) -> str:
        try:
            return time.fromisoformat(value).strftime("%H:%M")
        except ValueError as exc:
            raise ValueError("Enter a valid preferred time.") from exc

    @field_validator("reason")
    @classmethod
    def normalize_reason(cls, value: str) -> str:
        normalized = value.strip()
        if len(normalized) < 3:
            raise ValueError("Please provide a reason for the appointment.")
        return normalized

    @field_validator("additional_notes")
    @classmethod
    def normalize_additional_notes(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip()
        return normalized or None


class AppointmentDecisionRequest(BaseModel):
    decision: Literal["accepted", "rejected"]
    note: str | None = Field(default=None, max_length=3000)

    @field_validator("note")
    @classmethod
    def normalize_note(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip()
        return normalized or None

    @model_validator(mode="after")
    def rejection_requires_reason(self):
        if self.decision == "rejected" and (self.note is None or len(self.note) < 3):
            raise ValueError("A rejection note of at least 3 characters is required.")
        return self


class AppointmentAdminCancellationRequest(BaseModel):
    note: str = Field(min_length=3, max_length=3000)

    @field_validator("note")
    @classmethod
    def normalize_note(cls, value: str) -> str:
        normalized = value.strip()
        if len(normalized) < 3:
            raise ValueError("Please provide a reason for the cancellation.")
        return normalized


class AppointmentRescheduleRequest(BaseModel):
    appointment_date: date
    preferred_time: str
    note: str | None = Field(default=None, max_length=3000)

    @field_validator("appointment_date")
    @classmethod
    def require_future_date(cls, value: date) -> date:
        if value < date.today():
            raise ValueError("Proposed appointment date cannot be in the past.")
        return value

    @field_validator("preferred_time")
    @classmethod
    def normalize_time(cls, value: str) -> str:
        try:
            return time.fromisoformat(value).strftime("%H:%M")
        except ValueError as exc:
            raise ValueError("Enter a valid preferred time.") from exc

    @field_validator("note")
    @classmethod
    def normalize_note(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip()
        return normalized or None


class AppointmentRescheduleDecisionRequest(BaseModel):
    decision: Literal["accepted", "rejected"]
    note: str | None = Field(default=None, max_length=3000)

    @field_validator("note")
    @classmethod
    def normalize_note(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip()
        return normalized or None

    @model_validator(mode="after")
    def rejection_requires_reason(self):
        if self.decision == "rejected" and (self.note is None or len(self.note) < 3):
            raise ValueError("A rejection note of at least 3 characters is required.")
        return self


class AppointmentCompletionRequest(BaseModel):
    note: str | None = Field(default=None, max_length=3000)

    @field_validator("note")
    @classmethod
    def normalize_note(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip()
        return normalized or None


class AppointmentReassignmentRequest(BaseModel):
    note: str = Field(min_length=3, max_length=3000)

    @field_validator("note")
    @classmethod
    def normalize_note(cls, value: str) -> str:
        normalized = value.strip()
        if len(normalized) < 3:
            raise ValueError("Please provide a reason for reassignment.")
        return normalized


class AppointmentAdminReassignmentRequest(BaseModel):
    doctor_id: int = Field(gt=0)
    note: str = Field(min_length=3, max_length=3000)

    @field_validator("note")
    @classmethod
    def normalize_note(cls, value: str) -> str:
        normalized = value.strip()
        if len(normalized) < 3:
            raise ValueError("Please provide a reassignment note.")
        return normalized


class AppointmentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    patient_id: int
    doctor_id: int
    patient_name: str
    patient_email: str
    doctor_name: str
    doctor_specialization: str | None
    clinic_name: str | None
    doctor_active: bool
    appointment_date: date
    preferred_time: str
    reason: str
    additional_notes: str | None
    status: AppointmentStatus
    doctor_note: str | None
    admin_note: str | None
    reschedule_date: date | None
    reschedule_time: str | None
    reschedule_requested_by: Literal["patient", "doctor"] | None
    reassignment_requested: bool
    created_at: datetime
    updated_at: datetime

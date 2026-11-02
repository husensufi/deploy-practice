from datetime import date, datetime
import re
from typing import Literal

from pydantic import BaseModel, Field, field_validator


class CreateDoctorAccountRequest(BaseModel):
    # Personal Information
    full_name: str = Field(min_length=1, max_length=255)
    email: str = Field(min_length=3, max_length=320)
    mobile: str = Field(min_length=1, max_length=50)
    gender: str | None = Field(default=None, max_length=50)
    date_of_birth: str | None = Field(default=None, max_length=50)
    photo_url: str | None = Field(default=None, max_length=2000)

    # Professional Information
    medical_reg_no: str = Field(min_length=1, max_length=100)
    qualification: str = Field(min_length=1, max_length=255)
    specialization: str = Field(default="Gynecologist", min_length=1, max_length=255)
    years_experience: int | None = Field(default=None, ge=0, le=80)
    clinic_name: str = Field(min_length=1, max_length=255)
    city: str = Field(min_length=1, max_length=255)
    address: str = Field(min_length=1, max_length=1000)
    consultation_hours: str = Field(
        default="Mon–Sat, 10 AM – 6 PM", max_length=255
    )
    consultation_fee: int | None = Field(default=None, ge=0)
    about: str | None = Field(default=None, max_length=5000)

    # Account Information
    password: str = Field(min_length=8, max_length=128)
    approval_status: Literal["pending", "approved", "rejected"] = "pending"
    is_active: bool | None = None
    send_invitation: bool = True
    notes: str | None = None

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        normalized = value.strip().lower()
        if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", normalized):
            raise ValueError("Enter a valid email address.")
        return normalized

    @field_validator("full_name", "medical_reg_no", "qualification", "specialization", "clinic_name", "city", "address")
    @classmethod
    def trim_required_values(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("This field cannot be blank.")
        return normalized

    @field_validator("mobile")
    @classmethod
    def validate_mobile(cls, value: str) -> str:
        normalized = value.strip()
        digits = re.sub(r"\D", "", normalized)
        if not re.fullmatch(r"\+?[0-9][0-9\s().-]*", normalized) or not 7 <= len(digits) <= 15:
            raise ValueError("Enter a valid mobile number.")
        return normalized

    @field_validator("password")
    @classmethod
    def validate_password(cls, value: str) -> str:
        if len(value.strip()) < 8:
            raise ValueError("Temporary password must be at least 8 characters.")
        return value

    @field_validator("date_of_birth")
    @classmethod
    def validate_date_of_birth(cls, value: str | None) -> str | None:
        if value is None:
            return None
        try:
            parsed = date.fromisoformat(value)
        except ValueError as exc:
            raise ValueError("Enter a valid date of birth.") from exc
        if parsed > date.today():
            raise ValueError("Date of birth cannot be in the future.")
        return value


class UpdateDoctorAccountRequest(BaseModel):
    # Personal Information
    full_name: str | None = Field(default=None, min_length=1, max_length=255)
    email: str | None = Field(default=None, min_length=3, max_length=320)
    mobile: str | None = Field(default=None, min_length=1, max_length=50)
    gender: str | None = Field(default=None, max_length=50)
    date_of_birth: str | None = Field(default=None, max_length=50)
    photo_url: str | None = Field(default=None, max_length=2000)

    # Professional Information
    medical_reg_no: str | None = Field(default=None, max_length=100)
    qualification: str | None = Field(default=None, max_length=255)
    specialization: str | None = Field(default=None, max_length=255)
    years_experience: int | None = Field(default=None, ge=0, le=80)
    clinic_name: str | None = Field(default=None, max_length=255)
    city: str | None = Field(default=None, max_length=255)
    address: str | None = Field(default=None, max_length=1000)
    consultation_hours: str | None = Field(default=None, max_length=255)
    consultation_fee: int | None = Field(default=None, ge=0)
    about: str | None = Field(default=None, max_length=5000)

    # Account Information
    admin_notes: str | None = None
    is_active: bool | None = None
    approval_status: Literal["pending", "approved", "rejected"] | None = None

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip().lower()
        if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", normalized):
            raise ValueError("Enter a valid email address.")
        return normalized

    @field_validator("mobile")
    @classmethod
    def validate_mobile(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip()
        digits = re.sub(r"\D", "", normalized)
        if not re.fullmatch(r"\+?[0-9][0-9\s().-]*", normalized) or not 7 <= len(digits) <= 15:
            raise ValueError("Enter a valid mobile number.")
        return normalized

    @field_validator("full_name", "medical_reg_no", "qualification", "specialization", "clinic_name", "city", "address")
    @classmethod
    def trim_non_empty_values(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip()
        if not normalized:
            raise ValueError("This field cannot be blank.")
        return normalized

    @field_validator("date_of_birth")
    @classmethod
    def validate_date_of_birth(cls, value: str | None) -> str | None:
        if value is None:
            return None
        try:
            parsed = date.fromisoformat(value)
        except ValueError as exc:
            raise ValueError("Enter a valid date of birth.") from exc
        if parsed > date.today():
            raise ValueError("Date of birth cannot be in the future.")
        return value


class ResetDoctorPasswordRequest(BaseModel):
    new_password: str = Field(min_length=8, max_length=128)
    send_invitation: bool = True
    notes: str | None = None

    @field_validator("new_password")
    @classmethod
    def validate_new_password(cls, value: str) -> str:
        if len(value.strip()) < 8:
            raise ValueError("Temporary password must be at least 8 characters.")
        return value


class DoctorApprovalDecision(BaseModel):
    decision: str = Field(pattern="^(approved|rejected|pending|inactive)$")
    reason: str | None = None
    notes: str | None = None


class AccountStatusRequest(BaseModel):
    status: str = Field(pattern="^(active|inactive|removed)$")
    reason: str | None = Field(default=None, max_length=1000)


class AdminDashboardSummary(BaseModel):
    total_patients: int
    total_doctors: int
    approved_doctors: int
    pending_doctor_approvals: int
    rejected_doctors: int
    active_doctors: int
    inactive_doctors: int
    total_appointments: int
    pending_appointments: int
    accepted_appointments: int
    rejected_appointments: int
    cancelled_appointments: int
    completed_appointments: int
    rescheduled_appointments: int
    recent_patient_registrations: list[dict]
    recent_approved_doctors: list[dict]
    pending_doctor_alerts: list[dict]
    recent_appointment_activity: list[dict]


class AdminPatientRecord(BaseModel):
    id: int
    full_name: str
    email: str
    mobile: str | None
    role: str
    is_active: bool
    created_at: datetime | None = None


class AdminDoctorRecord(BaseModel):
    id: int
    full_name: str
    email: str
    mobile: str | None
    gender: str | None = None
    date_of_birth: str | None = None
    role: str
    is_active: bool
    approval_status: str | None
    rejection_reason: str | None
    admin_notes: str | None
    created_at: datetime | None = None
    specialization: str | None = None
    medical_reg_no: str | None = None
    qualification: str | None = None
    clinic_name: str | None = None
    consultation_fee: int | None = None
    years_experience: int | None = None
    consultation_hours: str | None = None
    about: str | None = None
    photo_url: str | None = None
    registered_by_admin_id: int | None = None
    appointment_count: int = 0

from datetime import datetime

from pydantic import BaseModel, Field


class CreateDoctorAccountRequest(BaseModel):
    full_name: str = Field(min_length=1, max_length=255)
    email: str = Field(min_length=3, max_length=320)
    mobile: str = Field(min_length=1, max_length=50)
    password: str = Field(min_length=8)
    approval_status: str = Field(default="pending")
    notes: str | None = None


class DoctorApprovalDecision(BaseModel):
    decision: str = Field(pattern="^(approved|rejected|pending|inactive)$")
    reason: str | None = None
    notes: str | None = None


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
    role: str
    is_active: bool
    approval_status: str | None
    rejection_reason: str | None
    admin_notes: str | None
    created_at: datetime | None = None

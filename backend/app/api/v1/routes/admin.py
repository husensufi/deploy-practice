from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.legacy import User, hash_password
from app.core.security import require_admin
from app.database.session import get_db
from app.schemas.admin import (
    AdminDashboardSummary,
    CreateDoctorAccountRequest,
    DoctorApprovalDecision,
)

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/dashboard", response_model=AdminDashboardSummary)
def admin_dashboard(
    _user: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict:
    patients = db.query(User).filter(User.role == "patient").all()
    doctors = db.query(User).filter(User.role == "doctor").all()

    summary = {
        "total_patients": len(patients),
        "total_doctors": len(doctors),
        "approved_doctors": sum(1 for doctor in doctors if getattr(doctor, "approval_status", "approved") == "approved"),
        "pending_doctor_approvals": sum(1 for doctor in doctors if getattr(doctor, "approval_status", "approved") == "pending"),
        "rejected_doctors": sum(1 for doctor in doctors if getattr(doctor, "approval_status", "approved") == "rejected"),
        "active_doctors": sum(1 for doctor in doctors if getattr(doctor, "is_active", True) and getattr(doctor, "approval_status", "approved") == "approved"),
        "inactive_doctors": sum(1 for doctor in doctors if not getattr(doctor, "is_active", True)),
        "total_appointments": 0,
        "pending_appointments": 0,
        "accepted_appointments": 0,
        "rejected_appointments": 0,
        "recent_patient_registrations": [
            {"id": patient.id, "full_name": patient.full_name, "email": patient.email, "created_at": patient.created_at.isoformat() if patient.created_at else None}
            for patient in sorted(patients, key=lambda item: item.created_at or datetime.min, reverse=True)[:5]
        ],
        "recent_approved_doctors": [
            {"id": doctor.id, "full_name": doctor.full_name, "email": doctor.email, "approval_status": getattr(doctor, "approval_status", "approved")}
            for doctor in sorted(doctors, key=lambda item: item.created_at or datetime.min, reverse=True)[:5]
            if getattr(doctor, "approval_status", "approved") == "approved"
        ],
        "pending_doctor_alerts": [
            {"id": doctor.id, "full_name": doctor.full_name, "email": doctor.email, "approval_status": getattr(doctor, "approval_status", "approved")}
            for doctor in doctors
            if getattr(doctor, "approval_status", "approved") == "pending"
        ],
        "recent_appointment_activity": [],
    }
    return summary


@router.post("/doctors", status_code=status.HTTP_201_CREATED)
def create_doctor_account(
    body: CreateDoctorAccountRequest,
    _user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    if db.query(User).filter(User.email == body.email.lower().strip()).first():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="An account with this email already exists.")

    doctor = User(
        full_name=body.full_name.strip(),
        email=body.email.strip().lower(),
        mobile=body.mobile.strip(),
        hashed_password=hash_password(body.password),
        role="doctor",
        is_active=(body.approval_status == "approved"),
        approval_status=body.approval_status,
        admin_notes=body.notes,
    )
    db.add(doctor)
    db.commit()
    db.refresh(doctor)
    return {
        "id": doctor.id,
        "full_name": doctor.full_name,
        "email": doctor.email,
        "approval_status": doctor.approval_status,
        "is_active": bool(getattr(doctor, "is_active", True)),
    }


@router.get("/patients")
def list_patients(
    _user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    rows = db.query(User).filter(User.role == "patient").order_by(User.created_at.desc()).all()
    return [
        {
            "id": user.id,
            "full_name": user.full_name,
            "email": user.email,
            "mobile": user.mobile,
            "role": user.role,
            "is_active": bool(getattr(user, "is_active", True)),
            "created_at": user.created_at.isoformat() if user.created_at else None,
        }
        for user in rows
    ]


@router.get("/doctors")
def list_doctors(
    _user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    rows = db.query(User).filter(User.role == "doctor").order_by(User.created_at.desc()).all()
    return [
        {
            "id": user.id,
            "full_name": user.full_name,
            "email": user.email,
            "mobile": user.mobile,
            "role": user.role,
            "is_active": bool(getattr(user, "is_active", True)),
            "approval_status": getattr(user, "approval_status", "approved"),
            "rejection_reason": getattr(user, "rejection_reason", None),
            "admin_notes": getattr(user, "admin_notes", None),
            "created_at": user.created_at.isoformat() if user.created_at else None,
        }
        for user in rows
    ]


@router.post("/doctors/{doctor_id}/decision")
def set_doctor_decision(
    doctor_id: int,
    payload: DoctorApprovalDecision,
    _user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    doctor = db.query(User).filter(User.id == doctor_id, User.role == "doctor").first()
    if doctor is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Doctor not found.")

    doctor.approval_status = payload.decision
    doctor.rejection_reason = payload.reason if payload.decision == "rejected" else None
    doctor.admin_notes = payload.notes if payload.notes else doctor.admin_notes
    if payload.decision == "approved":
        doctor.is_active = True
    elif payload.decision == "inactive":
        doctor.is_active = False
    db.commit()
    db.refresh(doctor)
    return {
        "id": doctor.id,
        "full_name": doctor.full_name,
        "approval_status": doctor.approval_status,
        "rejection_reason": doctor.rejection_reason,
        "admin_notes": doctor.admin_notes,
        "is_active": bool(getattr(doctor, "is_active", True)),
    }

from datetime import date, datetime
from io import BytesIO

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from reportlab.lib import colors
from reportlab.lib.pagesizes import landscape, letter
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
from sqlalchemy import func, or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, aliased

from app.core.legacy import (
    AdminAuditLog,
    Appointment,
    DoctorApprovalHistory,
    DoctorProfile,
    User,
    UserNotification,
    hash_password,
)
from app.core.security import require_admin
from app.database.session import get_db
from app.schemas.admin import (
    AccountStatusRequest,
    AdminDashboardSummary,
    CreateDoctorAccountRequest,
    DoctorApprovalDecision,
    ResetDoctorPasswordRequest,
    UpdateDoctorAccountRequest,
)

router = APIRouter(prefix="/admin", tags=["admin"])


def _record(user: User, db: Session) -> dict:
    appointment_count = db.query(Appointment).filter(
        or_(Appointment.patient_id == user.id, Appointment.doctor_id == user.id)
    ).count()
    profile = (
        db.query(DoctorProfile).filter(DoctorProfile.user_id == user.id).first()
        if user.role == "doctor"
        else None
    )
    rec = {
        "id": user.id,
        "full_name": user.full_name,
        "email": user.email,
        "mobile": user.mobile,
        "gender": getattr(user, "gender", None),
        "date_of_birth": getattr(user, "date_of_birth", None),
        "role": user.role,
        "is_active": bool(user.is_active),
        "is_removed": bool(getattr(user, "is_removed", False)),
        "approval_status": getattr(user, "approval_status", "approved"),
        "approval_decided_at": getattr(user, "approval_decided_at", None).isoformat()
        if getattr(user, "approval_decided_at", None)
        else None,
        "rejection_reason": getattr(user, "rejection_reason", None),
        "admin_notes": getattr(user, "admin_notes", None),
        "created_at": user.created_at.isoformat() if user.created_at else None,
        "appointment_count": appointment_count,
        "specialization": profile.specialization if profile else None,
    }
    if profile:
        rec.update({
            "medical_reg_no": getattr(profile, "medical_reg_no", None),
            "qualification": getattr(profile, "qualification", None),
            "clinic_name": getattr(profile, "clinic_name", None),
            "city": getattr(profile, "city", None),
            "address": getattr(profile, "address", None),
            "consultation_fee": getattr(profile, "consultation_fee", None),
            "years_experience": getattr(profile, "years_experience", None),
            "consultation_hours": getattr(profile, "consultation_hours", None),
            "about": getattr(profile, "about", None),
            "photo_url": getattr(profile, "photo_url", None),
            "registered_by_admin_id": getattr(profile, "registered_by_admin_id", None),
        })
    return rec


def _audit(
    db: Session, admin_id: int, action: str, target_id: int | None, details: str | None
) -> None:
    db.add(
        AdminAuditLog(
            admin_id=admin_id,
            target_user_id=target_id,
            action=action,
            details=details,
        )
    )


def _doctor_query(
    db: Session,
    approval_status: str | None,
    search: str | None,
    date_from: date | None,
    date_to: date | None,
    include_removed: bool = True,
):
    query = db.query(User).filter(User.role == "doctor")
    if not include_removed:
        query = query.filter(User.is_removed.is_(False))
    if approval_status and approval_status != "all":
        query = query.filter(User.approval_status == approval_status)
    if search:
        term = f"%{search.strip()}%"
        query = query.filter(or_(User.full_name.ilike(term), User.email.ilike(term)))
    if date_from:
        query = query.filter(func.date(User.created_at) >= date_from.isoformat())
    if date_to:
        query = query.filter(func.date(User.created_at) <= date_to.isoformat())
    return query.order_by(User.created_at.desc(), User.id.desc())


def _limit_query(query, limit: str, offset: int = 0):
    if limit != "all":
        query = query.limit(int(limit)).offset(offset)
    return query


@router.get("/dashboard", response_model=AdminDashboardSummary)
def admin_dashboard(
    _user: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict:
    patients = db.query(User).filter(User.role == "patient").all()
    doctors = db.query(User).filter(User.role == "doctor").all()
    patient_account = aliased(User)
    doctor_account = aliased(User)

    summary = {
        "total_patients": len(patients),
        "total_doctors": len(doctors),
        "approved_doctors": sum(1 for doctor in doctors if getattr(doctor, "approval_status", "approved") == "approved"),
        "pending_doctor_approvals": sum(1 for doctor in doctors if getattr(doctor, "approval_status", "approved") == "pending"),
        "rejected_doctors": sum(1 for doctor in doctors if getattr(doctor, "approval_status", "approved") == "rejected"),
        "active_doctors": sum(1 for doctor in doctors if getattr(doctor, "is_active", True) and getattr(doctor, "approval_status", "approved") == "approved"),
        "inactive_doctors": sum(1 for doctor in doctors if not getattr(doctor, "is_active", True)),
        "total_appointments": db.query(Appointment).count(),
        "pending_appointments": db.query(Appointment).filter(Appointment.status == "pending").count(),
        "accepted_appointments": db.query(Appointment).filter(Appointment.status == "accepted").count(),
        "rejected_appointments": db.query(Appointment).filter(Appointment.status == "rejected").count(),
        "cancelled_appointments": db.query(Appointment).filter(Appointment.status == "cancelled").count(),
        "completed_appointments": db.query(Appointment).filter(Appointment.status == "completed").count(),
        "rescheduled_appointments": db.query(Appointment).filter(Appointment.status == "rescheduled").count(),
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
        "recent_appointment_activity": [
            {
                "id": appointment.id,
                "patient_id": appointment.patient_id,
                "patient_name": patient.full_name,
                "doctor_id": appointment.doctor_id,
                "doctor_name": doctor.full_name,
                "appointment_date": appointment.appointment_date.isoformat(),
                "preferred_time": appointment.preferred_time,
                "status": appointment.status,
            }
            for appointment, patient, doctor in (
                db.query(Appointment, patient_account, doctor_account)
                .join(patient_account, Appointment.patient_id == patient_account.id)
                .join(doctor_account, Appointment.doctor_id == doctor_account.id)
                .order_by(Appointment.created_at.desc())
                .limit(5)
                .all()
            )
        ],
    }
    return summary


@router.post("/doctors", status_code=status.HTTP_201_CREATED)
def create_doctor_account(
    body: CreateDoctorAccountRequest,
    _user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    clean_email = body.email
    if db.query(User).filter(func.lower(User.email) == clean_email).first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        )

    med_reg = body.medical_reg_no
    duplicate_reg = (
        db.query(DoctorProfile)
        .filter(func.lower(DoctorProfile.medical_reg_no) == med_reg.lower())
        .first()
    )
    if duplicate_reg:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A doctor with this medical registration number already exists.",
        )

    is_active = (
        (body.is_active if body.is_active is not None else True)
        if body.approval_status == "approved"
        else False
    )

    doctor = User(
        full_name=body.full_name.strip(),
        email=clean_email,
        mobile=body.mobile,
        gender=body.gender.strip() if body.gender else None,
        date_of_birth=body.date_of_birth.strip() if body.date_of_birth else None,
        hashed_password=hash_password(body.password),
        role="doctor",
        is_active=is_active,
        approval_status=body.approval_status,
        admin_notes=body.notes,
        approval_decided_at=datetime.utcnow() if body.approval_status != "pending" else None,
    )
    db.add(doctor)
    try:
        db.flush()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email or mobile number already exists.",
        ) from exc

    profile = DoctorProfile(
        user_id=doctor.id,
        clinic_name=body.clinic_name,
        specialization=body.specialization,
        city=body.city,
        address=body.address,
        phone=body.mobile,
        years_experience=body.years_experience,
        consultation_hours=body.consultation_hours.strip(),
        about=body.about.strip() if body.about else None,
        photo_url=body.photo_url.strip() if body.photo_url else None,
        medical_reg_no=med_reg,
        qualification=body.qualification,
        consultation_fee=body.consultation_fee,
        registered_by_admin_id=_user.id,
    )
    db.add(profile)

    if body.approval_status != "pending":
        db.add(
            DoctorApprovalHistory(
                doctor_id=doctor.id,
                admin_id=_user.id,
                decision=body.approval_status,
                reason=body.notes,
            )
        )
    _audit(
        db,
        _user.id,
        "doctor_created",
        doctor.id,
        f"medical_reg_no={med_reg or 'none'}; approval_status={body.approval_status}",
    )
    db.add(
        UserNotification(
            user_id=doctor.id,
            category="doctor_registration",
            message=(
                f"Welcome Dr. {doctor.full_name}! Your doctor profile and account were created by Admin. "
                "Use the temporary password shared with you by Admin to sign in. "
                f"Approval status: {body.approval_status.title()}."
            ),
        )
    )
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email, mobile number, or medical registration number already exists.",
        ) from exc
    db.refresh(doctor)
    return _record(doctor, db)


@router.put("/doctors/{doctor_id}")
def update_doctor_details(
    doctor_id: int,
    body: UpdateDoctorAccountRequest,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    doctor = db.query(User).filter(User.id == doctor_id, User.role == "doctor").first()
    if doctor is None:
        raise HTTPException(status_code=404, detail="Doctor not found.")
    if getattr(doctor, "is_removed", False):
        raise HTTPException(status_code=409, detail="Removed doctor accounts cannot be edited.")

    if body.email:
        clean_email = body.email
        conflict = db.query(User).filter(
            func.lower(User.email) == clean_email,
            User.id != doctor.id,
        ).first()
        if conflict:
            raise HTTPException(status_code=409, detail="An account with this email already exists.")
        doctor.email = clean_email

    if body.full_name is not None:
        doctor.full_name = body.full_name.strip()
    if body.mobile is not None:
        conflict = db.query(User).filter(
            User.mobile == body.mobile,
            User.id != doctor.id,
        ).first()
        if conflict:
            raise HTTPException(status_code=409, detail="An account with this mobile number already exists.")
        doctor.mobile = body.mobile.strip()
    if body.gender is not None:
        doctor.gender = body.gender.strip() if body.gender else None
    if body.date_of_birth is not None:
        doctor.date_of_birth = body.date_of_birth.strip() if body.date_of_birth else None
    if body.admin_notes is not None:
        doctor.admin_notes = body.admin_notes

    profile = db.query(DoctorProfile).filter(DoctorProfile.user_id == doctor.id).first()
    if profile is None:
        profile = DoctorProfile(
            user_id=doctor.id,
            clinic_name="Hospital / Clinic",
            specialization="Gynecologist",
            city="City",
            address="Clinic Address",
            phone=doctor.mobile or "",
        )
        db.add(profile)

    if body.medical_reg_no is not None:
        med_reg = body.medical_reg_no.strip()
        if med_reg:
            conflict = db.query(DoctorProfile).filter(
                func.lower(DoctorProfile.medical_reg_no) == med_reg.lower(),
                DoctorProfile.user_id != doctor.id,
            ).first()
            if conflict:
                raise HTTPException(
                    status_code=409,
                    detail="A doctor with this medical registration number already exists.",
                )
        profile.medical_reg_no = med_reg or None

    if body.qualification is not None:
        profile.qualification = body.qualification.strip() or None
    if body.specialization is not None:
        profile.specialization = body.specialization.strip()
    if body.years_experience is not None:
        profile.years_experience = body.years_experience
    if body.clinic_name is not None:
        profile.clinic_name = body.clinic_name.strip()
    if body.city is not None:
        profile.city = body.city.strip()
    if body.address is not None:
        profile.address = body.address.strip()
    if body.consultation_hours is not None:
        profile.consultation_hours = body.consultation_hours.strip()
    if body.consultation_fee is not None:
        profile.consultation_fee = body.consultation_fee
    if body.about is not None:
        profile.about = body.about.strip() or None
    if body.photo_url is not None:
        profile.photo_url = body.photo_url.strip() or None
    if body.mobile is not None:
        profile.phone = body.mobile.strip()

    if body.approval_status is not None and body.approval_status != doctor.approval_status:
        doctor.approval_status = body.approval_status
        doctor.approval_decided_at = datetime.utcnow() if body.approval_status != "pending" else None
        if body.approval_status == "approved" and body.is_active is None:
            doctor.is_active = True
        elif body.approval_status != "approved":
            doctor.is_active = False
        db.add(
            DoctorApprovalHistory(
                doctor_id=doctor.id,
                admin_id=admin.id,
                decision=body.approval_status,
                reason=body.admin_notes or "Updated by administrator",
            )
        )

    if body.is_active is not None:
        if body.is_active and doctor.approval_status != "approved":
            raise HTTPException(status_code=409, detail="Only approved doctors can be activated.")
        doctor.is_active = bool(body.is_active)

    doctor.updated_at = datetime.utcnow()
    profile.updated_at = datetime.utcnow()

    _audit(db, admin.id, "doctor_updated", doctor.id, "Doctor personal and professional details updated.")
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="An account with this email, mobile number, or medical registration number already exists.",
        ) from exc
    db.refresh(doctor)
    return _record(doctor, db)


@router.post("/doctors/{doctor_id}/reset-password")
def reset_doctor_password(
    doctor_id: int,
    body: ResetDoctorPasswordRequest,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    doctor = db.query(User).filter(User.id == doctor_id, User.role == "doctor").first()
    if doctor is None:
        raise HTTPException(status_code=404, detail="Doctor not found.")
    if getattr(doctor, "is_removed", False):
        raise HTTPException(status_code=409, detail="Removed doctor accounts cannot receive credentials.")

    doctor.hashed_password = hash_password(body.new_password)
    doctor.token_version = getattr(doctor, "token_version", 0) + 1

    if body.send_invitation:
        db.add(
            UserNotification(
                user_id=doctor.id,
                category="account_invitation",
                message=(
                    "Your doctor portal password has been reset by Administrator. "
                    "Please check your setup invitation instructions or log in using updated credentials."
                ),
            )
        )

    _audit(db, admin.id, "doctor_password_reset", doctor.id, f"Invitation sent={body.send_invitation}")
    db.commit()
    return {
        "status": "success",
        "doctor_id": doctor.id,
        "message": "Doctor credentials updated and account invitation instructions recorded.",
    }


@router.delete("/doctors/{doctor_id}")
def remove_doctor(
    doctor_id: int,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    return _update_account_status(doctor_id, "doctor", AccountStatusRequest(status="removed"), admin, db)


@router.get("/patients")
def list_patients(
    _user: User = Depends(require_admin),
    db: Session = Depends(get_db),
    search: str | None = Query(default=None, max_length=255),
    limit: str = Query(default="all", pattern="^(10|50|100|all)$"),
    offset: int = Query(default=0, ge=0),
):
    query = db.query(User).filter(User.role == "patient")
    if search:
        term = f"%{search.strip()}%"
        query = query.filter(or_(User.full_name.ilike(term), User.email.ilike(term)))
    rows = _limit_query(query.order_by(User.created_at.desc()), limit, offset).all()
    return [_record(user, db) for user in rows]


@router.get("/patients/{patient_id}")
def get_patient_details(
    patient_id: int,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict:
    patient = db.query(User).filter(User.id == patient_id, User.role == "patient").first()
    if patient is None:
        raise HTTPException(status_code=404, detail="Patient not found.")
    _audit(db, admin.id, "view_patient_details", patient.id, None)
    db.commit()
    appointments = (
        db.query(Appointment)
        .filter(Appointment.patient_id == patient.id)
        .order_by(Appointment.appointment_date.desc(), Appointment.created_at.desc())
        .all()
    )
    return {
        **_record(patient, db),
        "appointments": [
            {
                "id": item.id,
                "doctor_id": item.doctor_id,
                "appointment_date": item.appointment_date.isoformat(),
                "preferred_time": item.preferred_time,
                "status": item.status,
            }
            for item in appointments
        ],
    }


def _update_account_status(
    account_id: int,
    role: str,
    payload: AccountStatusRequest,
    admin: User,
    db: Session,
) -> dict:
    account = db.query(User).filter(User.id == account_id, User.role == role).first()
    if account is None:
        raise HTTPException(status_code=404, detail=f"{role.title()} not found.")
    if getattr(account, "is_removed", False):
        raise HTTPException(status_code=409, detail="Removed accounts cannot be changed.")
    if payload.status == "active" and role == "doctor" and account.approval_status != "approved":
        raise HTTPException(
            status_code=409,
            detail="Only approved doctors can be reactivated.",
        )
    if payload.status != "removed" and account.is_active == (payload.status == "active"):
        return _record(account, db)

    now = datetime.utcnow()
    if payload.status == "active":
        account.is_active = True
    elif payload.status == "inactive":
        account.is_active = False
    else:
        account.is_active = False
        account.is_removed = True
        account.removed_at = now
    account.token_version = getattr(account, "token_version", 0) + 1

    if role == "doctor" and payload.status == "inactive":
        active_appointments = (
            db.query(Appointment)
            .filter(
                Appointment.doctor_id == account.id,
                Appointment.status.in_(("pending", "accepted", "rescheduled")),
            )
            .all()
        )
        for appointment in active_appointments:
            db.add(
                UserNotification(
                    user_id=appointment.patient_id,
                    category="doctor_inactive",
                    message=(
                        f"Dr. {account.full_name} is currently inactive. "
                        f"Please contact Admin about appointment {appointment.id}."
                    ),
                )
            )

    _audit(
        db,
        admin.id,
        f"{role}_{payload.status}",
        account.id,
        payload.reason,
    )
    db.commit()
    db.refresh(account)
    return _record(account, db)


@router.post("/doctors/{doctor_id}/status")
def set_doctor_status(
    doctor_id: int,
    payload: AccountStatusRequest,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict:
    return _update_account_status(doctor_id, "doctor", payload, admin, db)


@router.post("/patients/{patient_id}/status")
def set_patient_status(
    patient_id: int,
    payload: AccountStatusRequest,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict:
    return _update_account_status(patient_id, "patient", payload, admin, db)


@router.get("/audit-log")
def list_admin_audit_log(
    _user: User = Depends(require_admin),
    db: Session = Depends(get_db),
    limit: int = Query(default=100, ge=1, le=500),
) -> list[dict]:
    records = db.query(AdminAuditLog).order_by(AdminAuditLog.created_at.desc()).limit(limit).all()
    return [
        {
            "id": item.id,
            "admin_id": item.admin_id,
            "target_user_id": item.target_user_id,
            "action": item.action,
            "details": item.details,
            "created_at": item.created_at.isoformat(),
        }
        for item in records
    ]


@router.get("/doctors")
def list_doctors(
    _user: User = Depends(require_admin),
    db: Session = Depends(get_db),
    approval_status: str | None = Query(default=None, pattern="^(all|pending|approved|rejected)$"),
    search: str | None = Query(default=None, max_length=255),
    date_from: date | None = None,
    date_to: date | None = None,
    limit: str = Query(default="all", pattern="^(10|50|100|all)$"),
    offset: int = Query(default=0, ge=0),
    include_removed: bool = True,
):
    if date_from and date_to and date_from > date_to:
        raise HTTPException(status_code=422, detail="date_from must not be after date_to.")
    query = _doctor_query(
        db, approval_status, search, date_from, date_to, include_removed
    )
    return [_record(user, db) for user in _limit_query(query, limit, offset).all()]


@router.get("/doctors/approval-summary")
def approval_summary(
    _user: User = Depends(require_admin), db: Session = Depends(get_db)
) -> dict[str, int]:
    return {
        name: db.query(User).filter(
            User.role == "doctor",
            User.approval_status == name,
            User.is_removed.is_(False),
        ).count()
        for name in ("pending", "approved", "rejected")
    }


@router.get("/doctors/approval-report.pdf")
def export_doctor_approval_report(
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
    approval_status: str = Query(default="all", pattern="^(all|pending|approved|rejected)$"),
    search: str | None = Query(default=None, max_length=255),
    date_from: date | None = None,
    date_to: date | None = None,
    limit: str = Query(default="all", pattern="^(10|50|100|all)$"),
    include_removed: bool = Query(default=False),
):
    if date_from and date_to and date_from > date_to:
        raise HTTPException(status_code=422, detail="date_from must not be after date_to.")
    rows = _limit_query(
        _doctor_query(db, approval_status, search, date_from, date_to, include_removed), limit
    ).all()
    _audit(
        db,
        admin.id,
        "doctor_approval_report_export",
        None,
        f"status={approval_status}; limit={limit}; count={len(rows)}",
    )
    db.commit()
    buffer = BytesIO()
    document = SimpleDocTemplate(buffer, pagesize=landscape(letter), rightMargin=28, leftMargin=28)
    styles = getSampleStyleSheet()
    filters = (
        f"Status: {approval_status.title()} | Search: {search or 'None'} | "
        f"Date: {date_from or 'Any'} to {date_to or 'Any'} | Limit: {limit.title()}"
    )
    data = [[
        "Application ID", "Doctor Name", "Email", "Phone", "Specialization",
        "Application Date", "Status", "Decision Date",
    ]]
    for doctor in rows:
        profile = db.query(DoctorProfile).filter(DoctorProfile.user_id == doctor.id).first()
        data.append([
            str(doctor.id), doctor.full_name, doctor.email, doctor.mobile or "—",
            profile.specialization if profile else "—",
            doctor.created_at.strftime("%Y-%m-%d") if doctor.created_at else "—",
            doctor.approval_status or "approved",
            doctor.approval_decided_at.strftime("%Y-%m-%d") if doctor.approval_decided_at else "—",
        ])
    table = Table(data, repeatRows=1, colWidths=[60, 105, 150, 75, 100, 85, 65, 85])
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#6b244a")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("GRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#d8c8d0")),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#fbf5f8")]),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
    ]))
    document.build([
        Paragraph("PCOS GynoCare – Doctor Approval Report", styles["Title"]),
        Spacer(1, 8),
        Paragraph(filters, styles["BodyText"]),
        Paragraph(
            f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')} | "
            f"Exported records: {len(rows)}",
            styles["BodyText"],
        ),
        Spacer(1, 12),
        table,
    ])
    buffer.seek(0)
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": 'attachment; filename="doctor-approval-report.pdf"'},
    )


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

    if getattr(doctor, "is_removed", False):
        raise HTTPException(status_code=409, detail="Removed doctor accounts cannot be approved.")

    doctor.approval_status = payload.decision
    doctor.approval_decided_at = datetime.utcnow()
    doctor.rejection_reason = payload.reason if payload.decision == "rejected" else None
    doctor.admin_notes = payload.notes if payload.notes else doctor.admin_notes
    if payload.decision == "approved":
        doctor.is_active = True
    elif payload.decision in {"inactive", "rejected", "pending"}:
        doctor.is_active = False
    doctor.token_version = getattr(doctor, "token_version", 0) + 1
    db.add(
        DoctorApprovalHistory(
            doctor_id=doctor.id,
            admin_id=_user.id,
            decision=payload.decision,
            reason=payload.reason or payload.notes,
        )
    )
    db.add(
        UserNotification(
            user_id=doctor.id,
            category="doctor_approval",
            message=f"Your doctor application was {payload.decision}.",
        )
    )
    _audit(
        db,
        _user.id,
        "doctor_approval_decision",
        doctor.id,
        f"decision={payload.decision}; reason={payload.reason or ''}",
    )
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


@router.get("/doctors/{doctor_id}")
def get_doctor_details(
    doctor_id: int,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict:
    doctor = db.query(User).filter(User.id == doctor_id, User.role == "doctor").first()
    if doctor is None:
        raise HTTPException(status_code=404, detail="Doctor not found.")
    _audit(db, admin.id, "view_doctor_details", doctor.id, None)
    db.commit()
    profile = db.query(DoctorProfile).filter(DoctorProfile.user_id == doctor.id).first()
    history = (
        db.query(DoctorApprovalHistory)
        .filter(DoctorApprovalHistory.doctor_id == doctor.id)
        .order_by(DoctorApprovalHistory.created_at.desc())
        .all()
    )
    appointments = (
        db.query(Appointment)
        .filter(Appointment.doctor_id == doctor.id)
        .order_by(Appointment.appointment_date.desc(), Appointment.created_at.desc())
        .all()
    )
    return {
        **_record(doctor, db),
        "doctor_profile": {
            "specialization": profile.specialization if profile else None,
            "clinic_name": profile.clinic_name if profile else None,
            "city": profile.city if profile else None,
            "address": profile.address if profile else None,
            "phone": profile.phone if profile else None,
            "years_experience": profile.years_experience if profile else None,
            "consultation_hours": profile.consultation_hours if profile else None,
            "about": profile.about if profile else None,
            "photo_url": profile.photo_url if profile else None,
            "medical_reg_no": getattr(profile, "medical_reg_no", None) if profile else None,
            "qualification": getattr(profile, "qualification", None) if profile else None,
            "consultation_fee": getattr(profile, "consultation_fee", None) if profile else None,
            "registered_by_admin_id": getattr(profile, "registered_by_admin_id", None) if profile else None,
        } if profile else None,
        "approval_history": [
            {
                "decision": item.decision,
                "reason": item.reason,
                "created_at": item.created_at.isoformat(),
            }
            for item in history
        ],
        "appointments": [
            {
                "id": item.id,
                "patient_id": item.patient_id,
                "appointment_date": item.appointment_date.isoformat(),
                "preferred_time": item.preferred_time,
                "status": item.status,
            }
            for item in appointments
        ],
    }

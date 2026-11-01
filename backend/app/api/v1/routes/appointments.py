from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, aliased

from app.core.legacy import Appointment, DoctorProfile, User
from app.core.security import require_admin, require_doctor, require_patient
from app.database.session import get_db
from app.schemas.appointments import (
    AppointmentAdminCancellationRequest,
    AppointmentAdminReassignmentRequest,
    AppointmentCompletionRequest,
    AppointmentCreateRequest,
    AppointmentDecisionRequest,
    AppointmentReassignmentRequest,
    AppointmentRescheduleDecisionRequest,
    AppointmentRescheduleRequest,
    AppointmentResponse,
)

router = APIRouter(tags=["appointments"])


def _appointment_query(db: Session):
    patient = aliased(User)
    doctor = aliased(User)
    return (
        db.query(Appointment, patient, doctor, DoctorProfile)
        .join(patient, Appointment.patient_id == patient.id)
        .join(doctor, Appointment.doctor_id == doctor.id)
        .outerjoin(DoctorProfile, DoctorProfile.user_id == doctor.id)
    )


def _serialize_appointment(row) -> AppointmentResponse:
    appointment, patient, doctor, profile = row
    return AppointmentResponse(
        id=appointment.id,
        patient_id=patient.id,
        doctor_id=doctor.id,
        patient_name=patient.full_name,
        patient_email=patient.email,
        doctor_name=doctor.full_name,
        doctor_specialization=profile.specialization if profile else None,
        clinic_name=profile.clinic_name if profile else None,
        doctor_active=bool(doctor.is_active and doctor.approval_status == "approved"),
        appointment_date=appointment.appointment_date,
        preferred_time=appointment.preferred_time,
        reason=appointment.reason,
        status=appointment.status,
        doctor_note=appointment.doctor_note,
        admin_note=appointment.admin_note,
        reschedule_date=appointment.reschedule_date,
        reschedule_time=appointment.reschedule_time,
        reschedule_requested_by=appointment.reschedule_requested_by,
        reassignment_requested=appointment.reassignment_requested,
        created_at=appointment.created_at,
        updated_at=appointment.updated_at,
    )


def _get_appointment(db: Session, appointment_id: int) -> Appointment:
    appointment = db.query(Appointment).filter(Appointment.id == appointment_id).first()
    if appointment is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Appointment not found.")
    return appointment


def _ensure_slot_available(
    db: Session,
    doctor_id: int,
    appointment_date: date,
    preferred_time: str,
    *,
    exclude_appointment_id: int | None = None,
) -> None:
    query = db.query(Appointment.id).filter(
        Appointment.doctor_id == doctor_id,
        Appointment.appointment_date == appointment_date,
        Appointment.preferred_time == preferred_time,
        Appointment.status.in_(("pending", "accepted", "rescheduled")),
    )
    if exclude_appointment_id is not None:
        query = query.filter(Appointment.id != exclude_appointment_id)
    if query.first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This doctor already has a booking for that date and time.",
        )


@router.get("/appointments", response_model=list[AppointmentResponse])
def patient_appointments(
    user: User = Depends(require_patient),
    db: Session = Depends(get_db),
) -> list[AppointmentResponse]:
    rows = (
        _appointment_query(db)
        .filter(Appointment.patient_id == user.id)
        .order_by(Appointment.appointment_date.desc(), Appointment.preferred_time.desc())
        .all()
    )
    return [_serialize_appointment(row) for row in rows]


@router.post(
    "/appointments",
    response_model=AppointmentResponse,
    status_code=status.HTTP_201_CREATED,
)
def request_appointment(
    body: AppointmentCreateRequest,
    user: User = Depends(require_patient),
    db: Session = Depends(get_db),
) -> AppointmentResponse:
    doctor = (
        db.query(User)
        .filter(
            User.id == body.doctor_id,
            User.role == "doctor",
            User.is_active.is_(True),
            User.approval_status == "approved",
        )
        .first()
    )
    if doctor is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Approved active doctor not found.",
        )
    if db.query(DoctorProfile).filter(DoctorProfile.user_id == doctor.id).first() is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This doctor has not completed a clinic profile yet.",
        )

    _ensure_slot_available(db, doctor.id, body.appointment_date, body.preferred_time)

    appointment = Appointment(
        patient_id=user.id,
        doctor_id=doctor.id,
        appointment_date=body.appointment_date,
        preferred_time=body.preferred_time,
        reason=body.reason,
        status="pending",
    )
    db.add(appointment)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This doctor already has a booking for that date and time.",
        ) from exc
    db.refresh(appointment)
    row = _appointment_query(db).filter(Appointment.id == appointment.id).one()
    return _serialize_appointment(row)


@router.post("/appointments/{appointment_id}/cancel", response_model=AppointmentResponse)
def cancel_patient_appointment(
    appointment_id: int,
    user: User = Depends(require_patient),
    db: Session = Depends(get_db),
) -> AppointmentResponse:
    appointment = _get_appointment(db, appointment_id)
    if appointment.patient_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Appointment not found.")
    if appointment.status not in {"pending", "accepted", "rescheduled"}:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This appointment can no longer be cancelled.",
        )
    if appointment.status in {"accepted", "rescheduled"} and appointment.appointment_date <= date.today():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An appointment scheduled for today or earlier can no longer be cancelled.",
        )

    appointment.status = "cancelled"
    appointment.reschedule_date = None
    appointment.reschedule_time = None
    appointment.reschedule_requested_by = None
    appointment.reassignment_requested = False
    db.commit()
    db.refresh(appointment)
    return _serialize_appointment(_appointment_query(db).filter(Appointment.id == appointment.id).one())


@router.get("/doctor/appointments", response_model=list[AppointmentResponse])
def doctor_appointments(
    user: User = Depends(require_doctor),
    db: Session = Depends(get_db),
) -> list[AppointmentResponse]:
    rows = (
        _appointment_query(db)
        .filter(Appointment.doctor_id == user.id)
        .order_by(Appointment.appointment_date, Appointment.preferred_time)
        .all()
    )
    return [_serialize_appointment(row) for row in rows]


@router.post(
    "/doctor/appointments/{appointment_id}/decision",
    response_model=AppointmentResponse,
)
def decide_appointment(
    appointment_id: int,
    body: AppointmentDecisionRequest,
    user: User = Depends(require_doctor),
    db: Session = Depends(get_db),
) -> AppointmentResponse:
    appointment = _get_appointment(db, appointment_id)
    if appointment.doctor_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Appointment not found.")
    if appointment.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Only pending appointments can be accepted or rejected.",
        )
    appointment.status = body.decision
    appointment.doctor_note = body.note
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="That time slot is already accepted for another appointment.",
        ) from exc
    db.refresh(appointment)
    return _serialize_appointment(_appointment_query(db).filter(Appointment.id == appointment.id).one())


@router.post(
    "/doctor/appointments/{appointment_id}/complete",
    response_model=AppointmentResponse,
)
def complete_appointment(
    appointment_id: int,
    body: AppointmentCompletionRequest | None = None,
    user: User = Depends(require_doctor),
    db: Session = Depends(get_db),
) -> AppointmentResponse:
    appointment = _get_appointment(db, appointment_id)
    if appointment.doctor_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Appointment not found.")
    if appointment.status != "accepted":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Only accepted appointments can be marked completed.",
        )
    appointment.status = "completed"
    if body and body.note:
        appointment.doctor_note = body.note
    db.commit()
    db.refresh(appointment)
    return _serialize_appointment(_appointment_query(db).filter(Appointment.id == appointment.id).one())


@router.post(
    "/appointments/{appointment_id}/reschedule",
    response_model=AppointmentResponse,
)
def request_patient_reschedule(
    appointment_id: int,
    body: AppointmentRescheduleRequest,
    user: User = Depends(require_patient),
    db: Session = Depends(get_db),
) -> AppointmentResponse:
    appointment = _get_appointment(db, appointment_id)
    if appointment.patient_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Appointment not found.")
    if appointment.status != "accepted":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Only accepted appointments can be rescheduled.",
        )
    _ensure_slot_available(
        db,
        appointment.doctor_id,
        body.appointment_date,
        body.preferred_time,
        exclude_appointment_id=appointment.id,
    )
    appointment.status = "rescheduled"
    appointment.reschedule_date = body.appointment_date
    appointment.reschedule_time = body.preferred_time
    appointment.reschedule_requested_by = "patient"
    appointment.doctor_note = body.note
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="That time is no longer available.") from exc
    db.refresh(appointment)
    return _serialize_appointment(_appointment_query(db).filter(Appointment.id == appointment.id).one())


@router.post(
    "/doctor/appointments/{appointment_id}/reschedule",
    response_model=AppointmentResponse,
)
def propose_doctor_reschedule(
    appointment_id: int,
    body: AppointmentRescheduleRequest,
    user: User = Depends(require_doctor),
    db: Session = Depends(get_db),
) -> AppointmentResponse:
    appointment = _get_appointment(db, appointment_id)
    if appointment.doctor_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Appointment not found.")
    if appointment.status != "accepted":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Only accepted appointments can be rescheduled.",
        )
    _ensure_slot_available(
        db,
        appointment.doctor_id,
        body.appointment_date,
        body.preferred_time,
        exclude_appointment_id=appointment.id,
    )
    appointment.status = "rescheduled"
    appointment.reschedule_date = body.appointment_date
    appointment.reschedule_time = body.preferred_time
    appointment.reschedule_requested_by = "doctor"
    appointment.doctor_note = body.note
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="That time is no longer available.") from exc
    db.refresh(appointment)
    return _serialize_appointment(_appointment_query(db).filter(Appointment.id == appointment.id).one())


@router.post(
    "/appointments/{appointment_id}/reschedule-decision",
    response_model=AppointmentResponse,
)
def patient_decide_reschedule(
    appointment_id: int,
    body: AppointmentRescheduleDecisionRequest,
    user: User = Depends(require_patient),
    db: Session = Depends(get_db),
) -> AppointmentResponse:
    appointment = _get_appointment(db, appointment_id)
    if appointment.patient_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Appointment not found.")
    if appointment.status != "rescheduled" or appointment.reschedule_requested_by != "doctor":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="There is no doctor-proposed reschedule awaiting your response.",
        )
    if body.decision == "accepted":
        appointment.appointment_date = appointment.reschedule_date
        appointment.preferred_time = appointment.reschedule_time
        appointment.status = "accepted"
    else:
        appointment.status = "accepted"
    appointment.doctor_note = body.note or appointment.doctor_note
    appointment.reschedule_date = None
    appointment.reschedule_time = None
    appointment.reschedule_requested_by = None
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="That proposed time is no longer available.") from exc
    db.refresh(appointment)
    return _serialize_appointment(_appointment_query(db).filter(Appointment.id == appointment.id).one())


@router.post(
    "/doctor/appointments/{appointment_id}/reschedule-decision",
    response_model=AppointmentResponse,
)
def doctor_decide_reschedule(
    appointment_id: int,
    body: AppointmentRescheduleDecisionRequest,
    user: User = Depends(require_doctor),
    db: Session = Depends(get_db),
) -> AppointmentResponse:
    appointment = _get_appointment(db, appointment_id)
    if appointment.doctor_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Appointment not found.")
    if appointment.status != "rescheduled" or appointment.reschedule_requested_by != "patient":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="There is no patient reschedule request awaiting your response.",
        )
    if body.decision == "accepted":
        appointment.appointment_date = appointment.reschedule_date
        appointment.preferred_time = appointment.reschedule_time
    appointment.status = "accepted"
    appointment.doctor_note = body.note or appointment.doctor_note
    appointment.reschedule_date = None
    appointment.reschedule_time = None
    appointment.reschedule_requested_by = None
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="That proposed time is no longer available.") from exc
    db.refresh(appointment)
    return _serialize_appointment(_appointment_query(db).filter(Appointment.id == appointment.id).one())


@router.post(
    "/appointments/{appointment_id}/reassignment",
    response_model=AppointmentResponse,
)
def request_reassignment(
    appointment_id: int,
    body: AppointmentReassignmentRequest,
    user: User = Depends(require_patient),
    db: Session = Depends(get_db),
) -> AppointmentResponse:
    appointment = _get_appointment(db, appointment_id)
    if appointment.patient_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Appointment not found.")
    doctor = db.query(User).filter(User.id == appointment.doctor_id).first()
    if doctor and doctor.is_active and doctor.approval_status == "approved":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This doctor is active. Use the reschedule request instead.",
        )
    if appointment.status not in {"pending", "accepted", "rescheduled"}:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This appointment cannot be reassigned in its current state.",
        )
    appointment.reassignment_requested = True
    appointment.admin_note = body.note
    db.commit()
    db.refresh(appointment)
    return _serialize_appointment(_appointment_query(db).filter(Appointment.id == appointment.id).one())


@router.get("/admin/appointments", response_model=list[AppointmentResponse])
def admin_appointments(
    doctor_id: int | None = Query(default=None, gt=0),
    patient_id: int | None = Query(default=None, gt=0),
    appointment_status: str | None = Query(
        default=None,
        alias="status",
        pattern="^(pending|accepted|rejected|cancelled|completed|rescheduled)$",
    ),
    date_from: date | None = None,
    date_to: date | None = None,
    _user: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> list[AppointmentResponse]:
    if date_from and date_to and date_from > date_to:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="date_from must not be after date_to.")

    query = _appointment_query(db)
    if doctor_id:
        query = query.filter(Appointment.doctor_id == doctor_id)
    if patient_id:
        query = query.filter(Appointment.patient_id == patient_id)
    if appointment_status:
        query = query.filter(Appointment.status == appointment_status)
    if date_from:
        query = query.filter(Appointment.appointment_date >= date_from)
    if date_to:
        query = query.filter(Appointment.appointment_date <= date_to)
    rows = query.order_by(Appointment.appointment_date.desc(), Appointment.preferred_time.desc()).all()
    return [_serialize_appointment(row) for row in rows]


@router.post(
    "/admin/appointments/{appointment_id}/cancel",
    response_model=AppointmentResponse,
)
def admin_cancel_appointment(
    appointment_id: int,
    body: AppointmentAdminCancellationRequest,
    _user: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> AppointmentResponse:
    appointment = _get_appointment(db, appointment_id)
    if appointment.status not in {"pending", "accepted", "rescheduled"}:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Only pending or accepted appointments can be cancelled by Admin.",
        )
    appointment.status = "cancelled"
    appointment.admin_note = body.note
    appointment.reschedule_date = None
    appointment.reschedule_time = None
    appointment.reschedule_requested_by = None
    appointment.reassignment_requested = False
    db.commit()
    db.refresh(appointment)
    return _serialize_appointment(_appointment_query(db).filter(Appointment.id == appointment.id).one())


@router.post(
    "/admin/appointments/{appointment_id}/reassign",
    response_model=AppointmentResponse,
)
def admin_reassign_appointment(
    appointment_id: int,
    body: AppointmentAdminReassignmentRequest,
    _user: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> AppointmentResponse:
    appointment = _get_appointment(db, appointment_id)
    if appointment.status not in {"pending", "accepted", "rescheduled"}:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This appointment cannot be reassigned in its current state.",
        )
    doctor = (
        db.query(User)
        .filter(
            User.id == body.doctor_id,
            User.role == "doctor",
            User.is_active.is_(True),
            User.approval_status == "approved",
        )
        .first()
    )
    if doctor is None or doctor.id == appointment.doctor_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Select a different approved and active doctor.",
        )
    if db.query(DoctorProfile).filter(DoctorProfile.user_id == doctor.id).first() is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="The selected doctor does not have a clinic profile.",
        )
    _ensure_slot_available(
        db,
        doctor.id,
        appointment.appointment_date,
        appointment.preferred_time,
        exclude_appointment_id=appointment.id,
    )
    appointment.doctor_id = doctor.id
    appointment.status = "pending"
    appointment.doctor_note = None
    appointment.reschedule_date = None
    appointment.reschedule_time = None
    appointment.reschedule_requested_by = None
    appointment.reassignment_requested = False
    appointment.admin_note = body.note
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="The selected doctor already has a booking at that time.") from exc
    db.refresh(appointment)
    return _serialize_appointment(_appointment_query(db).filter(Appointment.id == appointment.id).one())

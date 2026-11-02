from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.legacy import DoctorProfile, User
from app.core.security import get_current_user, require_doctor
from app.database.session import get_db
from app.schemas.doctors import (
    DoctorDirectoryEntry,
    DoctorProfileResponse,
    DoctorProfileSubmitRequest,
)

router = APIRouter(prefix="/doctors", tags=["doctors"])


@router.get("", response_model=list[DoctorDirectoryEntry])
def list_doctors(
    _user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[DoctorDirectoryEntry]:
    rows = (
        db.query(DoctorProfile, User)
        .join(User, DoctorProfile.user_id == User.id)
        .filter(
            User.role == "doctor",
            User.is_active.is_(True),
            User.approval_status == "approved",
            User.is_removed.is_(False),
        )
        .order_by(User.full_name)
        .all()
    )
    return [
        DoctorDirectoryEntry(
            id=profile.id,
            user_id=doctor.id,
            full_name=doctor.full_name,
            specialization=profile.specialization,
            clinic_name=profile.clinic_name,
            city=profile.city,
            address=profile.address,
            phone=profile.phone,
            years_experience=profile.years_experience,
            consultation_hours=profile.consultation_hours,
            about=profile.about,
            photo_url=profile.photo_url,
            medical_reg_no=getattr(profile, "medical_reg_no", None),
            qualification=getattr(profile, "qualification", None),
            consultation_fee=getattr(profile, "consultation_fee", None),
        )
        for profile, doctor in rows
    ]


@router.get("/me", response_model=DoctorProfileResponse | None)
def get_my_doctor_profile(
    user: User = Depends(require_doctor),
    db: Session = Depends(get_db),
) -> DoctorProfile | None:
    return (
        db.query(DoctorProfile)
        .filter(DoctorProfile.user_id == user.id)
        .first()
    )


@router.put("/me", response_model=DoctorProfileResponse)
def update_my_doctor_profile(
    body: DoctorProfileSubmitRequest,
    user: User = Depends(require_doctor),
    db: Session = Depends(get_db),
) -> DoctorProfile:
    profile = (
        db.query(DoctorProfile)
        .filter(DoctorProfile.user_id == user.id)
        .first()
    )
    if profile is None:
        profile = DoctorProfile(user_id=user.id)
        db.add(profile)

    values = body.model_dump()
    values["photo_url"] = values["photo_url"] or None
    values["about"] = values["about"] or None
    medical_reg_no = values["medical_reg_no"]
    if medical_reg_no:
        medical_reg_no = medical_reg_no.strip()
        conflict = (
            db.query(DoctorProfile.id)
            .filter(
                func.lower(DoctorProfile.medical_reg_no) == medical_reg_no.lower(),
                DoctorProfile.user_id != user.id,
            )
            .first()
        )
        if conflict:
            raise HTTPException(
                status_code=409,
                detail="A doctor with this medical registration number already exists.",
            )
    values["medical_reg_no"] = medical_reg_no or None
    for field, value in values.items():
        if hasattr(profile, field):
            setattr(profile, field, value)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="A doctor with this medical registration number already exists.",
        ) from exc
    db.refresh(profile)
    return profile


@router.get("/{doctor_id}", response_model=DoctorDirectoryEntry)
def get_doctor(
    doctor_id: int,
    _user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DoctorDirectoryEntry:
    row = (
        db.query(DoctorProfile, User)
        .join(User, DoctorProfile.user_id == User.id)
        .filter(
            DoctorProfile.id == doctor_id,
            User.role == "doctor",
            User.is_active.is_(True),
            User.approval_status == "approved",
            User.is_removed.is_(False),
        )
        .first()
    )
    if row is None:
        raise HTTPException(status_code=404, detail="Doctor profile not found.")

    profile, doctor = row
    return DoctorDirectoryEntry(
        id=profile.id,
        user_id=doctor.id,
        full_name=doctor.full_name,
        specialization=profile.specialization,
        clinic_name=profile.clinic_name,
        city=profile.city,
        address=profile.address,
        phone=profile.phone,
        years_experience=profile.years_experience,
        consultation_hours=profile.consultation_hours,
        about=profile.about,
        photo_url=profile.photo_url,
        medical_reg_no=getattr(profile, "medical_reg_no", None),
        qualification=getattr(profile, "qualification", None),
        consultation_fee=getattr(profile, "consultation_fee", None),
    )

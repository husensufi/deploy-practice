from fastapi import APIRouter, Depends, HTTPException
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
        .order_by(User.full_name)
        .all()
    )
    return [
        DoctorDirectoryEntry(
            id=profile.id,
            full_name=doctor.full_name,
            specialization=profile.specialization,
            clinic_name=profile.clinic_name,
            city=profile.city,
            address=profile.address,
            phone=profile.phone,
            consultation_hours=profile.consultation_hours,
            about=profile.about,
            photo_url=profile.photo_url,
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
    for field, value in values.items():
        setattr(profile, field, value)
    db.commit()
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
        .filter(DoctorProfile.id == doctor_id)
        .first()
    )
    if row is None:
        raise HTTPException(status_code=404, detail="Doctor profile not found.")

    profile, doctor = row
    return DoctorDirectoryEntry(
        id=profile.id,
        full_name=doctor.full_name,
        specialization=profile.specialization,
        clinic_name=profile.clinic_name,
        city=profile.city,
        address=profile.address,
        phone=profile.phone,
        consultation_hours=profile.consultation_hours,
        about=profile.about,
        photo_url=profile.photo_url,
    )

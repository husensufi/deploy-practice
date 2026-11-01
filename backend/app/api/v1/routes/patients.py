from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.legacy import DailyLog, PCOSProfile, User, run_pcos_screening
from app.core.security import require_patient
from app.database.session import get_db
from app.schemas.auth import PatientUpdateRequest, UserResponse
from app.schemas.health import (
    DailyLogResponse,
    PatientDashboardResponse,
    PCOSProfileResponse,
    ScreeningResultResponse,
)

router = APIRouter(prefix="/patients", tags=["patients"])


@router.get("/me", response_model=UserResponse)
def get_patient(user: User = Depends(require_patient)) -> User:
    return user


@router.put("/me", response_model=UserResponse)
def update_patient(
    body: PatientUpdateRequest,
    user: User = Depends(require_patient),
    db: Session = Depends(get_db),
) -> User:
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(user, field, value)

    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="That mobile number is already in use.",
        ) from exc
    db.refresh(user)
    return user


@router.get("/dashboard", response_model=PatientDashboardResponse)
def patient_dashboard(
    user: User = Depends(require_patient),
    db: Session = Depends(get_db),
) -> PatientDashboardResponse:
    profile = (
        db.query(PCOSProfile)
        .filter(PCOSProfile.user_id == user.id)
        .first()
    )
    today_log = (
        db.query(DailyLog)
        .filter(DailyLog.user_id == user.id, DailyLog.log_date == date.today())
        .first()
    )
    recent_logs = (
        db.query(DailyLog)
        .filter(DailyLog.user_id == user.id)
        .order_by(DailyLog.log_date.desc())
        .limit(14)
        .all()
    )
    result = run_pcos_screening(profile) if profile else None

    return PatientDashboardResponse(
        user=UserResponse.model_validate(user),
        profile=PCOSProfileResponse.model_validate(profile) if profile else None,
        screening_result=(
            ScreeningResultResponse.model_validate(result) if result else None
        ),
        today_log=(
            DailyLogResponse.model_validate(today_log) if today_log else None
        ),
        recent_logs=[
            DailyLogResponse.model_validate(log) for log in recent_logs
        ],
    )

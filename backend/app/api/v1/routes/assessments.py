from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.legacy import PCOSProfile, User, run_pcos_screening
from app.core.security import require_patient
from app.database.session import get_db
from app.schemas.health import (
    AssessmentResponse,
    AssessmentSubmitRequest,
    PCOSProfileResponse,
    ScreeningResultResponse,
)

router = APIRouter(prefix="/assessments", tags=["assessments"])


def _assessment_response(profile: PCOSProfile) -> AssessmentResponse:
    result = run_pcos_screening(profile)
    return AssessmentResponse(
        profile=PCOSProfileResponse.model_validate(profile),
        result=ScreeningResultResponse.model_validate(result),
    )


@router.post("", response_model=AssessmentResponse)
def submit_assessment(
    body: AssessmentSubmitRequest,
    user: User = Depends(require_patient),
    db: Session = Depends(get_db),
) -> AssessmentResponse:
    profile = (
        db.query(PCOSProfile)
        .filter(PCOSProfile.user_id == user.id)
        .first()
    )
    if profile is None:
        profile = PCOSProfile(user_id=user.id)
        db.add(profile)

    for field, value in body.model_dump().items():
        setattr(profile, field, value)

    db.commit()
    db.refresh(profile)
    return _assessment_response(profile)


@router.get("/history", response_model=list[AssessmentResponse])
def assessment_history(
    user: User = Depends(require_patient),
    db: Session = Depends(get_db),
) -> list[AssessmentResponse]:
    profile = (
        db.query(PCOSProfile)
        .filter(PCOSProfile.user_id == user.id)
        .first()
    )
    return [_assessment_response(profile)] if profile else []


@router.get("/{assessment_id}", response_model=AssessmentResponse)
def get_assessment(
    assessment_id: int,
    user: User = Depends(require_patient),
    db: Session = Depends(get_db),
) -> AssessmentResponse:
    profile = (
        db.query(PCOSProfile)
        .filter(
            PCOSProfile.id == assessment_id,
            PCOSProfile.user_id == user.id,
        )
        .first()
    )
    if profile is None:
        raise HTTPException(status_code=404, detail="Assessment not found.")
    return _assessment_response(profile)

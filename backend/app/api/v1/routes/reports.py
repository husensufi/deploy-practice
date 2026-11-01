from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session

from app.core.legacy import (
    DailyLog,
    PCOSProfile,
    User,
    build_pdf_report,
    run_pcos_screening,
)
from app.core.security import require_patient
from app.database.session import get_db
from app.schemas.health import (
    DailyLogResponse,
    PCOSProfileResponse,
    ScreeningResultResponse,
)
from app.schemas.reports import ReportSummaryResponse

router = APIRouter(prefix="/reports", tags=["reports"])


def _report_data(user: User, db: Session):
    profile = (
        db.query(PCOSProfile)
        .filter(PCOSProfile.user_id == user.id)
        .first()
    )
    logs = (
        db.query(DailyLog)
        .filter(DailyLog.user_id == user.id)
        .order_by(DailyLog.log_date.desc())
        .limit(30)
        .all()
    )
    result = run_pcos_screening(profile) if profile else None
    return profile, result, logs


@router.get("", response_model=ReportSummaryResponse)
def get_report_summary(
    user: User = Depends(require_patient),
    db: Session = Depends(get_db),
) -> ReportSummaryResponse:
    profile, result, logs = _report_data(user, db)
    return ReportSummaryResponse(
        profile=PCOSProfileResponse.model_validate(profile) if profile else None,
        screening_result=(
            ScreeningResultResponse.model_validate(result) if result else None
        ),
        logs=[DailyLogResponse.model_validate(log) for log in logs],
    )


@router.get("/pdf")
def download_report_pdf(
    user: User = Depends(require_patient),
    db: Session = Depends(get_db),
) -> Response:
    profile, result, logs = _report_data(user, db)
    pdf_bytes = build_pdf_report(user, profile, result, logs)
    filename = f"PCOS_Report_{user.full_name.replace(' ', '_')}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )

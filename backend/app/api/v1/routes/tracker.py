from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.legacy import DailyLog, User
from app.core.security import require_patient
from app.database.session import get_db
from app.schemas.health import (
    DailyLogResponse,
    DailyLogSubmitRequest,
    TrackerSummaryResponse,
)

router = APIRouter(prefix="/tracker", tags=["daily tracker"])


@router.get("/daily", response_model=list[DailyLogResponse])
def get_daily_logs(
    log_date: date | None = None,
    limit: int = 14,
    user: User = Depends(require_patient),
    db: Session = Depends(get_db),
) -> list[DailyLog]:
    if limit < 1 or limit > 60:
        raise HTTPException(status_code=422, detail="Limit must be between 1 and 60.")

    query = db.query(DailyLog).filter(DailyLog.user_id == user.id)
    if log_date is not None:
        query = query.filter(DailyLog.log_date == log_date)
    return query.order_by(DailyLog.log_date.desc()).limit(limit).all()


@router.post("/daily", response_model=DailyLogResponse)
def save_today_log(
    body: DailyLogSubmitRequest,
    user: User = Depends(require_patient),
    db: Session = Depends(get_db),
) -> DailyLog:
    today = date.today()
    log = (
        db.query(DailyLog)
        .filter(DailyLog.user_id == user.id, DailyLog.log_date == today)
        .first()
    )
    if log is None:
        log = DailyLog(user_id=user.id, log_date=today)
        db.add(log)

    for field, value in body.model_dump().items():
        setattr(log, field, value)
    db.commit()
    db.refresh(log)
    return log


@router.put("/daily/{record_id}", response_model=DailyLogResponse)
def update_daily_log(
    record_id: int,
    body: DailyLogSubmitRequest,
    user: User = Depends(require_patient),
    db: Session = Depends(get_db),
) -> DailyLog:
    log = (
        db.query(DailyLog)
        .filter(DailyLog.id == record_id, DailyLog.user_id == user.id)
        .first()
    )
    if log is None:
        raise HTTPException(status_code=404, detail="Daily log not found.")

    for field, value in body.model_dump().items():
        setattr(log, field, value)
    db.commit()
    db.refresh(log)
    return log


@router.get("/summary", response_model=TrackerSummaryResponse)
def tracker_summary(
    user: User = Depends(require_patient),
    db: Session = Depends(get_db),
) -> TrackerSummaryResponse:
    total_entries = (
        db.query(func.count(DailyLog.id))
        .filter(DailyLog.user_id == user.id)
        .scalar()
    )
    latest = (
        db.query(DailyLog)
        .filter(DailyLog.user_id == user.id)
        .order_by(DailyLog.log_date.desc())
        .first()
    )
    today = (
        db.query(DailyLog)
        .filter(DailyLog.user_id == user.id, DailyLog.log_date == date.today())
        .first()
    )
    return TrackerSummaryResponse(
        today_date=date.today(),
        total_entries=total_entries or 0,
        latest_entry=DailyLogResponse.model_validate(latest) if latest else None,
        today_entry=DailyLogResponse.model_validate(today) if today else None,
    )

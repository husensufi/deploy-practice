import logging
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from ai.azure_openai import AzureOpenAIConfigurationError
from app.core.legacy import DailyLog, DoctorProfile, PCOSProfile, User
from app.core.security import get_current_user, require_admin, require_doctor, require_patient
from app.database.session import get_db
from app.models import Connection
from app.schemas.ai import (
    AIAdminAssistantRequest,
    AIChatRequest,
    AIContentGeneratorRequest,
    AIHealthInsightRequest,
    AIWellnessRequest,
)
from app.schemas.chat import ChatResponse
from app.services.ai import generate_ai_response

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/ai", tags=["ai"], dependencies=[Depends(get_current_user)])


def _serialize_record(record):
    if record is None:
        return {}
    payload = record.__dict__.copy()
    payload.pop("_sa_instance_state", None)
    return payload


def _platform_snapshot(db: Session) -> dict:
    patient_count = db.query(User).filter(User.role == "patient").count()
    doctor_count = db.query(User).filter(User.role == "doctor").count()
    approved_doctors = db.query(User).filter(User.role == "doctor", User.approval_status == "approved").count()
    pending_doctors = db.query(User).filter(User.role == "doctor", User.approval_status == "pending").count()
    rejected_doctors = db.query(User).filter(User.role == "doctor", User.approval_status == "rejected").count()
    active_doctors = db.query(User).filter(User.role == "doctor", User.is_active.is_(True), User.approval_status == "approved").count()

    patient_registrations = [
        {
            "month": month,
            "count": count,
        }
        for month, count in db.query(
            func.strftime("%Y-%m", User.created_at),
            func.count(User.id),
        )
        .filter(User.role == "patient")
        .group_by(func.strftime("%Y-%m", User.created_at))
        .order_by(func.strftime("%Y-%m", User.created_at))
        .all()
    ]

    doctor_registrations = [
        {
            "month": month,
            "count": count,
        }
        for month, count in db.query(
            func.strftime("%Y-%m", User.created_at),
            func.count(User.id),
        )
        .filter(User.role == "doctor")
        .group_by(func.strftime("%Y-%m", User.created_at))
        .order_by(func.strftime("%Y-%m", User.created_at))
        .all()
    ]

    pending_appointments = db.query(Connection).filter(Connection.status == "pending").count()
    accepted_appointments = db.query(Connection).filter(Connection.status == "accepted").count()
    rejected_appointments = 0

    return {
        "patients": patient_count,
        "doctors": doctor_count,
        "approved_doctors": approved_doctors,
        "pending_doctors": pending_doctors,
        "rejected_doctors": rejected_doctors,
        "active_doctors": active_doctors,
        "patient_registrations": patient_registrations,
        "doctor_registrations": doctor_registrations,
        "pending_appointments": pending_appointments,
        "accepted_appointments": accepted_appointments,
        "rejected_appointments": rejected_appointments,
        "generated_at": datetime.utcnow().isoformat(),
    }


@router.post("/patient/gynobuddy/chat")
def patient_gynobuddy_chat(
    body: AIChatRequest,
    _user: User = Depends(require_patient),
) -> ChatResponse:
    messages = [{"role": message.role, "content": message.content} for message in body.messages]
    try:
        reply = generate_ai_response(
            "gynobuddy",
            messages[-1]["content"],
            context={"conversation": messages[:-1], "latest_message": messages[-1]},
            max_tokens=400,
        )
    except AzureOpenAIConfigurationError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc

    return ChatResponse(reply=reply)


@router.post("/patient/health-insights")
def patient_health_insights(
    body: AIHealthInsightRequest,
    user: User = Depends(require_patient),
    db: Session = Depends(get_db),
) -> dict:
    profile = db.query(PCOSProfile).filter(PCOSProfile.user_id == user.id).first()
    recent_logs = (
        db.query(DailyLog)
        .filter(DailyLog.user_id == user.id)
        .order_by(DailyLog.log_date.desc())
        .limit(10)
        .all()
    )
    context = {
        "user_id": user.id,
        "full_name": user.full_name,
        "profile": _serialize_record(profile),
        "recent_logs": [_serialize_record(log) for log in recent_logs],
        "request": body.prompt,
    }
    try:
        summary = generate_ai_response("patient_insights", body.prompt, context=context, max_tokens=500)
    except AzureOpenAIConfigurationError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc
    return {"summary": summary, "source_metrics": context}


@router.post("/patient/wellness-recommendations")
def patient_wellness_recommendations(
    body: AIWellnessRequest,
    user: User = Depends(require_patient),
    db: Session = Depends(get_db),
) -> dict:
    recent_logs = (
        db.query(DailyLog)
        .filter(DailyLog.user_id == user.id)
        .order_by(DailyLog.log_date.desc())
        .limit(14)
        .all()
    )
    context = {
        "user_id": user.id,
        "goal": body.goal,
        "recent_logs": [_serialize_record(log) for log in recent_logs],
    }
    try:
        recommendations = generate_ai_response("wellness_recommendations", body.goal, context=context, max_tokens=500)
    except AzureOpenAIConfigurationError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc
    return {"recommendations": recommendations, "source_metrics": context}


@router.post("/patient/reports/summarize")
def patient_reports_summarize(
    body: AIHealthInsightRequest,
    user: User = Depends(require_patient),
    db: Session = Depends(get_db),
) -> dict:
    profile = db.query(PCOSProfile).filter(PCOSProfile.user_id == user.id).first()
    latest_logs = (
        db.query(DailyLog)
        .filter(DailyLog.user_id == user.id)
        .order_by(DailyLog.log_date.desc())
        .limit(5)
        .all()
    )
    context = {
        "patient_id": user.id,
        "profile": _serialize_record(profile),
        "recent_logs": [_serialize_record(log) for log in latest_logs],
        "focus": body.prompt,
    }
    try:
        summary = generate_ai_response("report_summary", body.prompt, context=context, max_tokens=500)
    except AzureOpenAIConfigurationError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc
    return {"summary": summary, "source_metrics": context}


@router.post("/doctor/patients/{patient_id}/summary")
def doctor_patient_summary(
    patient_id: int,
    body: AIHealthInsightRequest,
    _user: User = Depends(require_doctor),
    db: Session = Depends(get_db),
) -> dict:
    patient = db.query(User).filter(User.id == patient_id, User.role == "patient").first()
    if patient is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient not found.")
    profile = db.query(PCOSProfile).filter(PCOSProfile.user_id == patient.id).first()
    recent_logs = (
        db.query(DailyLog)
        .filter(DailyLog.user_id == patient.id)
        .order_by(DailyLog.log_date.desc())
        .limit(10)
        .all()
    )
    context = {
        "patient_id": patient.id,
        "patient_name": patient.full_name,
        "profile": _serialize_record(profile),
        "recent_logs": [_serialize_record(log) for log in recent_logs],
        "focus": body.prompt,
    }
    try:
        summary = generate_ai_response("doctor_assistant", body.prompt, context=context, max_tokens=500)
    except AzureOpenAIConfigurationError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc
    return {"summary": summary, "source_metrics": context}


@router.post("/doctor/consultation-assistant")
def doctor_consultation_assistant(
    body: AIHealthInsightRequest,
    _user: User = Depends(require_doctor),
    db: Session = Depends(get_db),
) -> dict:
    doctor_profile = db.query(DoctorProfile).filter(DoctorProfile.user_id == _user.id).first()
    context = {
        "doctor_id": _user.id,
        "doctor_name": _user.full_name,
        "doctor_profile": _serialize_record(doctor_profile),
        "prompt": body.prompt,
    }
    try:
        summary = generate_ai_response("doctor_assistant", body.prompt, context=context, max_tokens=500)
    except AzureOpenAIConfigurationError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc
    return {"summary": summary, "source_metrics": context}


@router.post("/doctor/reports/summarize")
def doctor_reports_summarize(
    body: AIHealthInsightRequest,
    _user: User = Depends(require_doctor),
    db: Session = Depends(get_db),
) -> dict:
    latest_logs = (
        db.query(DailyLog)
        .filter(DailyLog.user_id == _user.id)
        .order_by(DailyLog.log_date.desc())
        .limit(10)
        .all()
    )
    context = {"doctor_id": _user.id, "recent_logs": [_serialize_record(log) for log in latest_logs], "focus": body.prompt}
    try:
        summary = generate_ai_response("report_summary", body.prompt, context=context, max_tokens=500)
    except AzureOpenAIConfigurationError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc
    return {"summary": summary, "source_metrics": context}


@router.post("/admin/assistant")
def admin_assistant(
    body: AIAdminAssistantRequest,
    _user: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict:
    metrics = _platform_snapshot(db)
    try:
        answer = generate_ai_response(
            "admin_assistant",
            body.question,
            context={
                "date_from": body.date_from,
                "date_to": body.date_to,
                "metrics": metrics,
            },
            max_tokens=500,
        )
    except AzureOpenAIConfigurationError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc
    return {"answer": answer, "source_metrics": metrics}


@router.get("/admin/platform-insights")
def admin_platform_insights(
    _user: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict:
    metrics = _platform_snapshot(db)
    try:
        summary = generate_ai_response(
            "admin_assistant",
            "Summarize the latest platform activity and highlight any operational attention areas.",
            context={"metrics": metrics},
            max_tokens=500,
        )
    except AzureOpenAIConfigurationError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc
    return {"metrics": metrics, "summary": summary}


@router.post("/admin/content-generator")
def admin_content_generator(
    body: AIContentGeneratorRequest,
    _user: User = Depends(require_admin),
) -> dict:
    try:
        draft = generate_ai_response(
            "content_generation",
            f"Create a {body.category} draft about {body.topic} for {body.audience}.",
            context={
                "category": body.category,
                "topic": body.topic,
                "audience": body.audience,
                "status": "draft_review_required",
            },
            max_tokens=700,
        )
    except AzureOpenAIConfigurationError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc
    return {
        "category": body.category,
        "topic": body.topic,
        "audience": body.audience,
        "draft": draft,
        "is_ai_generated": True,
        "review_required": True,
        "publishable": False,
    }

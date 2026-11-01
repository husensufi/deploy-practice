from fastapi import APIRouter
from app.api.v1.routes.appointments import router as appointments_router
from app.api.v1.routes.ai import router as ai_router
from app.api.v1.routes.admin import router as admin_router
from app.api.v1.routes.assessments import router as assessments_router
from app.api.v1.routes.auth import router as auth_router
from app.api.v1.routes.chat import router as chat_router
from app.api.v1.routes.connections import router as connections_router
from app.api.v1.routes.doctors import router as doctors_router
from app.api.v1.health import router as health_router
from app.api.v1.routes.patients import router as patients_router
from app.api.v1.routes.reports import router as reports_router
from app.api.v1.routes.tracker import router as tracker_router
from app.api.v1.routes.wellness import router as wellness_router

api_router = APIRouter()
api_router.include_router(health_router)
api_router.include_router(ai_router)
api_router.include_router(admin_router)
api_router.include_router(appointments_router)
api_router.include_router(auth_router)
api_router.include_router(chat_router)
api_router.include_router(connections_router)
api_router.include_router(patients_router)
api_router.include_router(assessments_router)
api_router.include_router(tracker_router)
api_router.include_router(doctors_router)
api_router.include_router(reports_router)
api_router.include_router(wellness_router)

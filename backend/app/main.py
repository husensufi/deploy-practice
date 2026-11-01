from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_router
from app.core.config import settings
from app.api.v1.routes.chat_websocket import router as websocket_router

app = FastAPI(
    title="Ashwini Asangi PCOS GynoCare API",
    version="1.0.0",
    description="Independent API for the PCOS GynoCare React application.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)

app.include_router(api_router, prefix="/api/v1")
app.state.frontend_origin = settings.frontend_url
app.include_router(websocket_router, prefix="/api/v1")

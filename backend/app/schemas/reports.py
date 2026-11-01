from pydantic import BaseModel

from app.schemas.health import (
    DailyLogResponse,
    PCOSProfileResponse,
    ScreeningResultResponse,
)


class ReportSummaryResponse(BaseModel):
    profile: PCOSProfileResponse | None
    screening_result: ScreeningResultResponse | None
    logs: list[DailyLogResponse]

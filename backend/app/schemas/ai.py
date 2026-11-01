from typing import Literal

from pydantic import BaseModel, Field


class AIChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=4000)


class AIChatRequest(BaseModel):
    messages: list[AIChatMessage] = Field(min_length=1, max_length=20)


class AIHealthInsightRequest(BaseModel):
    prompt: str = Field(default="Provide a brief health insight summary.", min_length=1, max_length=2000)


class AIWellnessRequest(BaseModel):
    goal: str = Field(default="Support my wellness goals.", min_length=1, max_length=2000)


class AIAdminAssistantRequest(BaseModel):
    question: str = Field(min_length=3, max_length=3000)
    date_from: str | None = None
    date_to: str | None = None


class AIContentGeneratorRequest(BaseModel):
    category: Literal[
        "pcos_education",
        "yoga_tutorial",
        "exercise_tutorial",
        "wellness_guidance",
        "faq",
        "nutrition",
        "awareness",
    ]
    topic: str = Field(min_length=3, max_length=500)
    audience: str = Field(default="patients", min_length=1, max_length=200)

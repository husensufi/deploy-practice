from typing import Literal

from pydantic import BaseModel


class MovementTutorial(BaseModel):
    id: str
    category: Literal["Yoga", "Breathing"]
    name: str
    description: str
    difficulty: Literal["Gentle"]
    duration_seconds: int
    instructions: list[str]
    video_search_url: str


class WellnessGame(BaseModel):
    id: Literal["bubbles", "runner", "match", "craving"]
    name: str
    description: str


class MovementTutorialList(BaseModel):
    disclaimer: str
    tutorials: list[MovementTutorial]

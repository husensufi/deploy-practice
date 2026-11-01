from fastapi import APIRouter, Depends, HTTPException, status

from app.core.security import require_patient
from app.schemas.wellness import MovementTutorial, MovementTutorialList, WellnessGame
from app.services.wellness import (
    MOVEMENT_DISCLAIMER,
    MOVEMENT_TUTORIALS,
    WELLNESS_GAMES,
    get_movement_tutorial,
)

router = APIRouter(
    prefix="/wellness",
    tags=["wellness"],
    dependencies=[Depends(require_patient)],
)


@router.get("/tutorials", response_model=MovementTutorialList)
def list_movement_tutorials() -> MovementTutorialList:
    return MovementTutorialList(
        disclaimer=MOVEMENT_DISCLAIMER,
        tutorials=list(MOVEMENT_TUTORIALS),
    )


@router.get("/tutorials/{tutorial_id}", response_model=MovementTutorial)
def movement_tutorial(tutorial_id: str) -> MovementTutorial:
    tutorial = get_movement_tutorial(tutorial_id)
    if tutorial is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Movement tutorial not found.",
        )
    return tutorial


@router.get("/games", response_model=list[WellnessGame])
def list_wellness_games() -> list[WellnessGame]:
    return list(WELLNESS_GAMES)

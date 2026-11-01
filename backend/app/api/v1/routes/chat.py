import logging

from fastapi import APIRouter, Depends, HTTPException, status
from openai import APIError, AuthenticationError

from ai.azure_openai import AzureOpenAIConfigurationError
from app.core.security import get_current_user
from app.schemas.chat import ChatRequest, ChatResponse
from app.services.ai import generate_ai_response

logger = logging.getLogger(__name__)
router = APIRouter(
    prefix="/chat",
    tags=["chat"],
    dependencies=[Depends(get_current_user)],
)

@router.post("/reply", response_model=ChatResponse)
def reply(body: ChatRequest) -> ChatResponse:
    conversation = [message.model_dump() for message in body.messages]
    latest_message = conversation[-1]
    try:
        content = generate_ai_response(
            "gynobuddy",
            latest_message["content"],
            context={
                "conversation": conversation[:-1],
                "latest_message": latest_message,
            },
            max_tokens=400,
        )
    except AzureOpenAIConfigurationError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc
    except AuthenticationError as exc:
        logger.exception("Azure OpenAI rejected the configured credentials")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Azure OpenAI rejected the configured credentials. Contact the app administrator.",
        ) from exc
    except APIError as exc:
        logger.exception("Azure OpenAI request failed")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="GynoBuddy could not respond right now. Please try again.",
        ) from exc
    except RuntimeError as exc:
        logger.exception("AI service returned an unexpected empty response")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="GynoBuddy returned an empty response. Please try again.",
        ) from exc

    if not content or not content.strip():
        logger.error("Azure OpenAI returned an empty chat completion")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="GynoBuddy returned an empty response. Please try again.",
        )
    return ChatResponse(reply=content.strip())

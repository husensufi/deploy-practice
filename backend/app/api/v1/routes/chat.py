import logging

from fastapi import APIRouter, Depends, HTTPException, status
from openai import APIError, AuthenticationError

from backend.ai import azure_openai
from backend.ai.azure_openai import AzureOpenAIConfigurationError
from app.core.security import get_current_user
from app.schemas.chat import ChatRequest, ChatResponse

logger = logging.getLogger(__name__)
router = APIRouter(
    prefix="/chat",
    tags=["chat"],
    dependencies=[Depends(get_current_user)],
)

SYSTEM_PROMPT = """You are GynoBuddy, a warm and supportive AI companion in the
Ashwini Asangi PCOS GynoCare app. Respond in a caring, non-judgmental voice and
keep replies short and conversational (2-5 sentences).

You are not a doctor: do not diagnose, prescribe medication, or recommend
dosages. Encourage users with medical concerns to speak with a gynecologist.
If a user expresses self-harm or immediate crisis, respond empathetically and
encourage immediate support from a trusted person or mental health professional.
In India, iCall (9152987821) and AASRA (9820466726) are available for support.
Suggest app features only when relevant, and never present screening as diagnosis."""


@router.post("/reply", response_model=ChatResponse)
def reply(body: ChatRequest) -> ChatResponse:
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    messages.extend(message.model_dump() for message in body.messages)
    try:
        content = azure_openai.create_chat_completion(messages, max_tokens=400)
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

    if not content or not content.strip():
        logger.error("Azure OpenAI returned an empty chat completion")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="GynoBuddy returned an empty response. Please try again.",
        )
    return ChatResponse(reply=content.strip())

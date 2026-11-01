import logging

from fastapi import APIRouter, Depends, HTTPException, status
from openai import APIError, AzureOpenAI

from app.core.config import settings
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
    endpoint = settings.azure_openai_endpoint
    api_key = settings.azure_openai_api_key
    deployment = settings.azure_openai_deployment
    api_version = settings.azure_openai_api_version
    if not endpoint or not api_key or not deployment or not api_version:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="GynoBuddy is not configured. Contact the app administrator.",
        )

    try:
        client = AzureOpenAI(
            azure_endpoint=endpoint,
            api_key=api_key,
            api_version=api_version,
            timeout=30.0,
        )
        messages = [{"role": "system", "content": SYSTEM_PROMPT}]
        messages.extend(message.model_dump() for message in body.messages)
        completion = client.chat.completions.create(
            model=deployment,
            messages=messages,
            max_tokens=400,
        )
    except APIError as exc:
        logger.exception("Azure OpenAI request failed")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="GynoBuddy could not respond right now. Please try again.",
        ) from exc

    content = completion.choices[0].message.content if completion.choices else None
    if not content or not content.strip():
        logger.error("Azure OpenAI returned an empty chat completion")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="GynoBuddy returned an empty response. Please try again.",
        )
    return ChatResponse(reply=content.strip())

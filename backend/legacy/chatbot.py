from ai import azure_openai
from app.services.ai import load_prompt

SYSTEM_PROMPT = load_prompt("gynobuddy")


def get_ai_reply(conversation_history: list) -> str | None:
    """
    conversation_history: a list of {"role": "user" | "assistant", "content": "..."}
    Returns the AI's next reply as a plain string.
    """
    reply = azure_openai.create_chat_completion(
        [{"role": "system", "content": SYSTEM_PROMPT}, *conversation_history],
        max_tokens=400,
    )
    return reply.strip() if reply else None

import json
import logging
from pathlib import Path
from typing import Any

from ai import azure_openai

logger = logging.getLogger(__name__)
PROMPT_DIR = Path(__file__).resolve().parents[1] / "prompts"


def load_prompt(template_name: str) -> str:
    if not template_name or Path(template_name).name != template_name:
        raise ValueError("Prompt name must be a plain template name.")
    prompt_path = PROMPT_DIR / f"{template_name}.md"
    if not prompt_path.exists():
        raise FileNotFoundError(f"Prompt template not found: {template_name}")
    return prompt_path.read_text(encoding="utf-8").strip()


def generate_ai_response(
    template_name: str,
    user_request: str,
    *,
    context: dict[str, Any] | None = None,
    max_tokens: int = 500,
) -> str:
    template = load_prompt(template_name)
    structured_context = json.dumps(context or {}, ensure_ascii=False, default=str)
    messages = [
        {"role": "system", "content": template},
        {
            "role": "user",
            "content": (
                f"Context:\n{structured_context}\n\nRequest:\n{user_request}"
            ),
        },
    ]

    content = azure_openai.create_chat_completion(messages, max_tokens=max_tokens)
    if not content or not content.strip():
        raise RuntimeError("Azure OpenAI returned an empty response.")
    return content.strip()

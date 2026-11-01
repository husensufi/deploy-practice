import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv
from openai import OpenAIError, AzureOpenAI

BACKEND_ROOT = Path(__file__).resolve().parents[1]
load_dotenv(BACKEND_ROOT / ".env")


@dataclass(frozen=True)
class AzureOpenAISettings:
    endpoint: str | None
    api_key: str | None
    deployment: str | None
    api_version: str


settings = AzureOpenAISettings(
    endpoint=os.getenv("AZURE_OPENAI_ENDPOINT"),
    api_key=os.getenv("AZURE_OPENAI_API_KEY"),
    deployment=os.getenv("AZURE_OPENAI_DEPLOYMENT"),
    api_version=os.getenv("AZURE_OPENAI_API_VERSION", "2024-10-21"),
)


class AzureOpenAIConfigurationError(RuntimeError):
    pass


@lru_cache(maxsize=1)
def _create_client(endpoint: str, api_key: str, api_version: str) -> AzureOpenAI:
    try:
        return AzureOpenAI(
            azure_endpoint=endpoint,
            api_key=api_key,
            api_version=api_version,
            timeout=30.0,
        )
    except (OpenAIError, ValueError) as exc:
        raise AzureOpenAIConfigurationError(
            "Azure OpenAI configuration is invalid. Check the endpoint, key, "
            "and API version in backend/.env."
        ) from exc


def create_chat_completion(
    messages: list[dict[str, str]],
    *,
    max_tokens: int = 400,
) -> str | None:
    endpoint = settings.endpoint
    api_key = settings.api_key
    deployment = settings.deployment
    api_version = settings.api_version
    configuration = {
        "AZURE_OPENAI_ENDPOINT": endpoint,
        "AZURE_OPENAI_API_KEY": api_key,
        "AZURE_OPENAI_DEPLOYMENT": deployment,
        "AZURE_OPENAI_API_VERSION": api_version,
    }
    missing = [name for name, value in configuration.items() if not value]
    if missing:
        raise AzureOpenAIConfigurationError(
            "Azure OpenAI is not configured. Set "
            + ", ".join(missing)
            + " in backend/.env."
        )

    client = _create_client(
        endpoint,
        api_key,
        api_version,
    )
    completion = client.chat.completions.create(
        model=deployment,
        messages=messages,
        max_tokens=max_tokens,
    )
    if not completion.choices:
        return None
    return completion.choices[0].message.content

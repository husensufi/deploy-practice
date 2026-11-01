from functools import lru_cache

from openai import OpenAIError, AzureOpenAI

from app.core.config import settings


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
            "and API version in backend/.env or the project root .env."
        ) from exc


def create_chat_completion(
    messages: list[dict[str, str]],
    *,
    max_tokens: int = 400,
) -> str | None:
    endpoint = settings.azure_openai_endpoint
    api_key = settings.azure_openai_api_key
    deployment = settings.azure_openai_deployment
    api_version = settings.azure_openai_api_version
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
            + " in backend/.env or the project root .env."
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

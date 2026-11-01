from dataclasses import replace

import pytest

from ai import azure_openai
from legacy import chatbot


def test_legacy_chatbot_uses_shared_azure_service(monkeypatch) -> None:
    monkeypatch.setattr(
        azure_openai,
        "settings",
        replace(
            azure_openai.settings,
            azure_openai_endpoint="https://example.openai.azure.com",
            azure_openai_api_key="test-key",
            azure_openai_deployment="test-deployment",
            azure_openai_api_version="2024-10-21",
        ),
    )
    request = {}

    def create_completion(messages, *, max_tokens):
        request["messages"] = messages
        request["max_tokens"] = max_tokens
        return "  I can share general information.  "

    monkeypatch.setattr(azure_openai, "create_chat_completion", create_completion)
    result = chatbot.get_ai_reply(
        [{"role": "user", "content": "What is PCOS?"}]
    )

    assert result == "I can share general information."
    assert request["messages"][0] == {
        "role": "system",
        "content": chatbot.SYSTEM_PROMPT,
    }
    assert request["messages"][1] == {
        "role": "user",
        "content": "What is PCOS?",
    }
    assert request["max_tokens"] == 400


def test_legacy_chatbot_raises_clear_missing_configuration_error(monkeypatch) -> None:
    monkeypatch.setattr(
        azure_openai,
        "settings",
        replace(
            azure_openai.settings,
            azure_openai_endpoint=None,
            azure_openai_api_key=None,
            azure_openai_deployment=None,
        ),
    )

    with pytest.raises(azure_openai.AzureOpenAIConfigurationError) as error:
        chatbot.get_ai_reply([{"role": "user", "content": "Hello"}])

    assert "AZURE_OPENAI_ENDPOINT" in str(error.value)
    assert "AZURE_OPENAI_API_KEY" in str(error.value)

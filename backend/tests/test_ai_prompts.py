from pathlib import Path

import pytest

from app.services import ai
from ai import azure_openai


EXPECTED_PROMPTS = {
    "admin_assistant",
    "content_generation",
    "doctor_assistant",
    "gynobuddy",
    "patient_insights",
    "report_summary",
    "wellness_recommendations",
}


def test_all_application_prompts_are_structured_markdown_files() -> None:
    prompt_files = {path.stem for path in ai.PROMPT_DIR.glob("*.md")}
    legacy_text_files = list(ai.PROMPT_DIR.glob("*.txt"))

    assert prompt_files == EXPECTED_PROMPTS
    assert legacy_text_files == []
    for template_name in EXPECTED_PROMPTS:
        prompt = ai.load_prompt(template_name)
        assert prompt.startswith("# ")
        assert "## Objective" in prompt
        assert "## Input and trust boundaries" in prompt
        assert "## Response format" in prompt


@pytest.mark.parametrize("template_name", ["../.env", "folder/prompt", ""])
def test_prompt_loader_rejects_non_template_names(template_name: str) -> None:
    with pytest.raises(ValueError, match="plain template name"):
        ai.load_prompt(template_name)


def test_generate_ai_response_uses_markdown_prompt_as_system_message(monkeypatch) -> None:
    captured = {}

    def fake_create_chat_completion(messages, *, max_tokens):
        captured["messages"] = messages
        captured["max_tokens"] = max_tokens
        return "  General information only.  "

    monkeypatch.setattr(azure_openai, "create_chat_completion", fake_create_chat_completion)
    response = ai.generate_ai_response(
        "patient_insights",
        "Summarize recent patterns",
        context={"tracker_entries": 2},
        max_tokens=123,
    )

    assert response == "General information only."
    assert captured["messages"][0] == {
        "role": "system",
        "content": ai.load_prompt("patient_insights"),
    }
    assert captured["messages"][1]["role"] == "user"
    assert "Summarize recent patterns" in captured["messages"][1]["content"]
    assert '"tracker_entries": 2' in captured["messages"][1]["content"]
    assert captured["max_tokens"] == 123

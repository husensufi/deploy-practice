"""
chatbot.py
----------
GynoBuddy — a real AI chatbot, not a fixed set of canned answers.

Every reply here is generated fresh by an actual language model (Claude,
via the Anthropic API), based on the full conversation so far. That's
what makes it give different, context-aware answers instead of
repeating the same 4-5 lines.

SETUP REQUIRED (this is not optional — there is no way around it):
    1. Go to https://console.anthropic.com and create a free account.
    2. Generate an API key.
    3. Copy .env.example to a new file named ".env" in this same folder.
    4. Paste your key in there: ANTHROPIC_API_KEY=sk-ant-xxxxxxxx
    5. Restart the server.

Without this key, the chatbot will politely tell the user it isn't
connected yet — it will NOT pretend to work with fake responses.
"""

import os
from dotenv import load_dotenv
import anthropic

load_dotenv()

_api_key = os.getenv("ANTHROPIC_API_KEY")
_client = anthropic.Anthropic(api_key=_api_key) if _api_key else None

# This system prompt is what makes GynoBuddy's personality and safety
# rules consistent across every message, while still letting each
# individual reply be generated freshly by the model.
SYSTEM_PROMPT = """You are GynoBuddy, a warm and supportive AI companion
inside the "Ashwini Asangi PCOS GynoCare" app. You talk with young women
about their PCOS symptoms, mood, cravings, cycle tracking, and daily
self-care in a caring, non-judgmental, conversational voice.

Rules you always follow:
- Keep replies short and conversational (2-5 sentences), like a
  supportive friend texting back, not an essay.
- You are NOT a doctor. Never diagnose, never suggest medication or
  dosages. For any medical concern, gently encourage using the app's
  Doctors section or seeing a real gynecologist.
- Vary your language naturally — never reuse the same stock phrases
  across a conversation. Respond to what the person actually said.
- If someone expresses thoughts of self-harm, suicide, or being in
  crisis, respond with warmth and take it seriously. Encourage them to
  reach out to a mental health professional right away, and mention
  that iCall (9152987821) and AASRA (9820466726) are free, confidential
  helplines in India available for support.
- You can suggest the app's own features when relevant (Daily Tracker,
  home remedies on the Tracker page, Reports, Games for a mood break,
  or reaching out to their connected friend/partner) but don't force it
  into every message.
"""


def get_ai_reply(conversation_history: list) -> str:
    """
    conversation_history: a list of {"role": "user" | "assistant", "content": "..."}
    Returns the AI's next reply as a plain string.
    """
    if not _client:
        return (
            "⚠️ GynoBuddy isn't connected yet. Add your ANTHROPIC_API_KEY "
            "to a .env file in the project folder (see .env.example) and "
            "restart the server to activate real AI replies."
        )

    try:
        response = _client.messages.create(
            model="claude-sonnet-5",
            max_tokens=400,
            system=SYSTEM_PROMPT,
            messages=conversation_history,
        )
        return response.content[0].text
    except Exception as e:
        return f"Sorry, I couldn't reach GynoBuddy right now. ({str(e)})"

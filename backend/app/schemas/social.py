from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class ConnectionCreateRequest(BaseModel):
    friend_email: str = Field(min_length=3, max_length=320)
    relationship_type: Literal[
        "partner", "husband", "boyfriend", "brother", "sister", "friend"
    ] = "friend"

    @field_validator("friend_email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        normalized = value.strip().lower()
        if "@" not in normalized:
            raise ValueError("Enter a valid email address.")
        return normalized


class ConnectionResponse(BaseModel):
    id: int
    other_user_id: int
    other_user_name: str
    relationship_type: str
    status: Literal["pending", "accepted"]
    direction: Literal["incoming", "outgoing", "accepted"]
    created_at: datetime


class ConnectionListResponse(BaseModel):
    accepted: list[ConnectionResponse]
    pending_incoming: list[ConnectionResponse]
    pending_outgoing: list[ConnectionResponse]


class SocialChatMessageResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    sender_id: int
    receiver_id: int
    content: str
    message_type: str
    created_at: datetime | None


class SocialChatResponse(BaseModel):
    friend_id: int
    friend_name: str
    messages: list[SocialChatMessageResponse]


class ChatSendRequest(BaseModel):
    content: str = Field(min_length=1, max_length=4000)

    @field_validator("content")
    @classmethod
    def trim_content(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("Messages cannot be blank.")
        return normalized


class GameInviteRequest(BaseModel):
    game_name: Literal[
        "Zen Bubbles", "Aura Runner", "Mind Match", "Guess My Craving"
    ]


class CareAlertResponse(BaseModel):
    message: SocialChatMessageResponse

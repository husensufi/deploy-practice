"""
models_social.py
-----------------
Two tables power the "Friends & Family" feature:

1. Connection
   - A link between two users (e.g. you <-> your husband/bf/sister/friend).
   - Created as "pending" when you send a request by their email,
     becomes "accepted" once they approve it. Just like a friend
     request on any social app.

2. ChatMessage
   - Every message sent between two connected users, including
     normal text AND special "care_alert" messages (the one-tap
     "I need care" button sends one of these).
   - This is what makes the chat real-time and persistent — refresh
     the page and your messages are still there, loaded from here.
"""

from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from datetime import datetime
from database import Base


class Connection(Base):
    __tablename__ = "connections"

    id = Column(Integer, primary_key=True, index=True)
    requester_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    receiver_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    # partner | husband | boyfriend | brother | sister | friend
    relationship_type = Column(String, default="friend")

    status = Column(String, default="pending")  # "pending" | "accepted"
    created_at = Column(DateTime, default=datetime.utcnow)


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(Integer, primary_key=True, index=True)
    sender_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    receiver_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    content = Column(Text, nullable=False)
    message_type = Column(String, default="text")  # "text" | "care_alert"

    created_at = Column(DateTime, default=datetime.utcnow)

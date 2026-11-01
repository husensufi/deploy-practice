from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.core.legacy import ChatMessage, Connection, User


def get_connection(
    db: Session,
    connection_id: int,
    receiver_id: int,
) -> Connection | None:
    return (
        db.query(Connection)
        .filter(
            Connection.id == connection_id,
            Connection.receiver_id == receiver_id,
            Connection.status == "pending",
        )
        .first()
    )


def accepted_connection(
    db: Session,
    user_id: int,
    friend_id: int,
) -> bool:
    return (
        db.query(Connection.id)
        .filter(
            or_(
                (Connection.requester_id == user_id)
                & (Connection.receiver_id == friend_id),
                (Connection.requester_id == friend_id)
                & (Connection.receiver_id == user_id),
            ),
            Connection.status == "accepted",
        )
        .first()
        is not None
    )


def connection_rows(db: Session, user_id: int, status: str):
    rows = (
        db.query(Connection)
        .filter(
            or_(
                (Connection.requester_id == user_id)
                & (Connection.status == status),
                (Connection.receiver_id == user_id)
                & (Connection.status == status),
            )
        )
        .order_by(Connection.created_at.desc())
        .all()
    )
    for connection in rows:
        other_id = (
            connection.receiver_id
            if connection.requester_id == user_id
            else connection.requester_id
        )
        other_user = db.query(User).filter(User.id == other_id).first()
        if other_user is not None:
            yield connection, other_user


def conversation_messages(
    db: Session,
    user_id: int,
    friend_id: int,
) -> list[ChatMessage]:
    return (
        db.query(ChatMessage)
        .filter(
            or_(
                (ChatMessage.sender_id == user_id)
                & (ChatMessage.receiver_id == friend_id),
                (ChatMessage.sender_id == friend_id)
                & (ChatMessage.receiver_id == user_id),
            )
        )
        .order_by(ChatMessage.created_at.asc(), ChatMessage.id.asc())
        .all()
    )


def create_message(
    db: Session,
    sender_id: int,
    receiver_id: int,
    content: str,
    message_type: str = "text",
) -> ChatMessage:
    message = ChatMessage(
        sender_id=sender_id,
        receiver_id=receiver_id,
        content=content,
        message_type=message_type,
    )
    db.add(message)
    db.commit()
    db.refresh(message)
    return message

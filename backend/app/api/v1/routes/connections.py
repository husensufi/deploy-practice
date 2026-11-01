from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.core.legacy import Connection, DailyLog, User
from app.core.security import get_current_user
from app.database.session import get_db
from app.schemas.social import (
    CareAlertResponse,
    ConnectionCreateRequest,
    ConnectionListResponse,
    ConnectionResponse,
    GameInviteRequest,
    SocialChatMessageResponse,
    SocialChatResponse,
)
from app.services.social import (
    accepted_connection,
    connection_rows,
    conversation_messages,
    create_message,
    get_connection,
)
from app.websocket.manager import manager

router = APIRouter(prefix="/connections", tags=["connections"])


def _connection_response(connection: Connection, other_user: User, current_id: int):
    if connection.status == "accepted":
        direction = "accepted"
    elif connection.receiver_id == current_id:
        direction = "incoming"
    else:
        direction = "outgoing"

    return ConnectionResponse(
        id=connection.id,
        other_user_id=other_user.id,
        other_user_name=other_user.full_name,
        relationship_type=connection.relationship_type,
        status=connection.status,
        direction=direction,
        created_at=connection.created_at,
    )


@router.get("", response_model=ConnectionListResponse)
def list_connections(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ConnectionListResponse:
    accepted = [
        _connection_response(connection, other, user.id)
        for connection, other in connection_rows(db, user.id, "accepted")
    ]
    incoming = [
        _connection_response(connection, other, user.id)
        for connection, other in connection_rows(db, user.id, "pending")
        if connection.receiver_id == user.id
    ]
    outgoing = [
        _connection_response(connection, other, user.id)
        for connection, other in connection_rows(db, user.id, "pending")
        if connection.requester_id == user.id
    ]
    return ConnectionListResponse(
        accepted=accepted,
        pending_incoming=incoming,
        pending_outgoing=outgoing,
    )


@router.post("", response_model=ConnectionResponse, status_code=status.HTTP_201_CREATED)
def create_connection(
    body: ConnectionCreateRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ConnectionResponse:
    friend = db.query(User).filter(User.email.ilike(body.friend_email)).first()
    if friend is None:
        raise HTTPException(status_code=404, detail="No account found for that email.")
    if friend.id == user.id:
        raise HTTPException(status_code=400, detail="You cannot connect with yourself.")

    existing = (
        db.query(Connection)
        .filter(
            or_(
                (Connection.requester_id == user.id)
                & (Connection.receiver_id == friend.id),
                (Connection.requester_id == friend.id)
                & (Connection.receiver_id == user.id),
            )
        )
        .first()
    )
    if existing is not None:
        raise HTTPException(
            status_code=409,
            detail="A connection request or connection already exists.",
        )

    connection = Connection(
        requester_id=user.id,
        receiver_id=friend.id,
        relationship_type=body.relationship_type,
        status="pending",
    )
    db.add(connection)
    db.commit()
    db.refresh(connection)
    return _connection_response(connection, friend, user.id)


@router.post("/{connection_id}/accept", response_model=ConnectionResponse)
def accept_connection(
    connection_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ConnectionResponse:
    connection = get_connection(db, connection_id, user.id)
    if connection is None:
        raise HTTPException(status_code=404, detail="Pending request not found.")
    requester = db.query(User).filter(User.id == connection.requester_id).first()
    if requester is None:
        raise HTTPException(status_code=404, detail="Requesting account not found.")
    connection.status = "accepted"
    db.commit()
    db.refresh(connection)
    return _connection_response(connection, requester, user.id)


@router.get("/{friend_id}/chat", response_model=SocialChatResponse)
def get_chat(
    friend_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SocialChatResponse:
    friend = db.query(User).filter(User.id == friend_id).first()
    if friend is None or not accepted_connection(db, user.id, friend_id):
        raise HTTPException(status_code=404, detail="Connected user not found.")

    messages = conversation_messages(db, user.id, friend_id)
    return SocialChatResponse(
        friend_id=friend.id,
        friend_name=friend.full_name,
        messages=[
            SocialChatMessageResponse.model_validate(message)
            for message in messages
        ],
    )


@router.post("/{friend_id}/care-alert", response_model=CareAlertResponse)
async def send_care_alert(
    friend_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CareAlertResponse:
    if not accepted_connection(db, user.id, friend_id):
        raise HTTPException(status_code=404, detail="Connected user not found.")

    today_log = (
        db.query(DailyLog)
        .filter(DailyLog.user_id == user.id, DailyLog.log_date == date.today())
        .first()
    )
    if today_log and today_log.on_period and today_log.cramp_pain_level >= 6:
        content = (
            f"💗 {user.full_name} is on her period today with strong cramp pain "
            f"({today_log.cramp_pain_level}/10). She could use some extra care right now."
        )
    elif today_log and today_log.mood in ("irritated", "sad", "anxious"):
        content = (
            f"💗 {user.full_name} is feeling {today_log.mood} today and wanted you to know. "
            "A little extra kindness would go a long way right now."
        )
    else:
        content = (
            f"💗 {user.full_name} wanted to let you know she could use some care "
            "and attention today."
        )

    message = create_message(db, user.id, friend_id, content, "care_alert")
    await manager.broadcast(
        manager.room_key(user.id, friend_id),
        {
            "id": message.id,
            "sender_id": user.id,
            "sender_name": user.full_name,
            "receiver_id": friend_id,
            "content": message.content,
            "time": message.created_at.strftime("%I:%M %p"),
            "message_type": "care_alert",
        },
    )
    return CareAlertResponse(message=SocialChatMessageResponse.model_validate(message))


@router.post("/{friend_id}/notify", response_model=CareAlertResponse)
async def notify_care(
    friend_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CareAlertResponse:
    return await send_care_alert(friend_id, user, db)


@router.post("/{friend_id}/games/invite", status_code=status.HTTP_201_CREATED)
def invite_to_game(
    friend_id: int,
    body: GameInviteRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, int | str]:
    if not accepted_connection(db, user.id, friend_id):
        raise HTTPException(status_code=404, detail="Connected user not found.")

    message = create_message(
        db,
        user.id,
        friend_id,
        f'🎮 {user.full_name} invites you to play "{body.game_name}"! '
        "Open Games from the menu to join in.",
    )
    return {"message_id": message.id, "friend_id": friend_id}

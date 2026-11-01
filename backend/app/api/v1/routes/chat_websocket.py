import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.core.security import ACCESS_TOKEN_COOKIE, decode_access_token
from app.database.session import SessionLocal
from app.models import User
from app.services.social import accepted_connection, create_message
from app.websocket.manager import manager

logger = logging.getLogger(__name__)
router = APIRouter(tags=["real-time chat"])


@router.websocket("/ws/chat/{friend_id}")
async def websocket_chat(websocket: WebSocket, friend_id: int) -> None:
    origin = websocket.headers.get("origin")
    if origin != websocket.app.state.frontend_origin:
        await websocket.close(code=1008)
        return

    token = websocket.cookies.get(ACCESS_TOKEN_COOKIE)
    payload = decode_access_token(token) if token else None
    email = payload.get("sub") if payload else None
    if not isinstance(email, str):
        await websocket.close(code=1008)
        return

    db = SessionLocal()
    room = None
    user = None
    try:
        user = db.query(User).filter(User.email == email).first()
        if user is None or not accepted_connection(db, user.id, friend_id):
            await websocket.close(code=1008)
            return

        room = manager.room_key(user.id, friend_id)
        await manager.connect(websocket, room)
        while True:
            data = await websocket.receive_json()
            content = data.get("content") if isinstance(data, dict) else None
            if not isinstance(content, str):
                await websocket.send_json({"error": "Message content must be text."})
                continue
            content = content.strip()
            if not content:
                continue
            if len(content) > 4000:
                await websocket.send_json({"error": "Messages must be 4000 characters or fewer."})
                continue
            if not accepted_connection(db, user.id, friend_id):
                await websocket.close(code=1008)
                break

            message = create_message(db, user.id, friend_id, content)
            await manager.broadcast(
                room,
                {
                    "id": message.id,
                    "sender_id": user.id,
                    "sender_name": user.full_name,
                    "receiver_id": friend_id,
                    "content": message.content,
                    "time": message.created_at.strftime("%I:%M %p"),
                    "message_type": message.message_type,
                },
            )
    except WebSocketDisconnect:
        pass
    except (ValueError, TypeError):
        logger.exception("Invalid WebSocket chat payload")
        await websocket.close(code=1003)
    finally:
        if room is not None:
            await manager.disconnect(websocket, room)
        db.close()

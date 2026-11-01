import asyncio

from fastapi import WebSocket, WebSocketDisconnect


class ConnectionManager:
    def __init__(self) -> None:
        self.active: dict[str, set[WebSocket]] = {}
        self._lock = asyncio.Lock()

    @staticmethod
    def room_key(user_a: int, user_b: int) -> str:
        return f"{min(user_a, user_b)}_{max(user_a, user_b)}"

    async def connect(self, websocket: WebSocket, room: str) -> None:
        await websocket.accept()
        async with self._lock:
            self.active.setdefault(room, set()).add(websocket)

    async def disconnect(self, websocket: WebSocket, room: str) -> None:
        async with self._lock:
            sockets = self.active.get(room)
            if sockets is None:
                return
            sockets.discard(websocket)
            if not sockets:
                self.active.pop(room, None)

    async def broadcast(self, room: str, message: dict) -> None:
        async with self._lock:
            sockets = tuple(self.active.get(room, set()))

        stale = []
        for websocket in sockets:
            try:
                await websocket.send_json(message)
            except (WebSocketDisconnect, RuntimeError):
                stale.append(websocket)

        if stale:
            async with self._lock:
                remaining = self.active.get(room)
                if remaining is not None:
                    remaining.difference_update(stale)
                    if not remaining:
                        self.active.pop(room, None)


manager = ConnectionManager()

"""
WebSocket Connection Manager
Handles multiple rooms, each with multiple connected clients.
Thread-safe for asyncio (single-process uvicorn).
"""
import json
import asyncio
from collections import defaultdict
from fastapi import WebSocket
from app.websocket.events import EventType, make_event


class RoomState:
    """In-memory state for a single session room."""

    def __init__(self, room_token: str):
        self.room_token = room_token
        self.connections: dict[int, WebSocket] = {}   # user_id → websocket
        self.user_info: dict[int, dict] = {}          # user_id → {name, role}
        self.shared_code: str = "# Start coding here...\n"
        self.shared_language: str = "python"
        self.transcript_buffer: list[str] = []        # for cognitive anchor

    def add_user(self, user_id: int, ws: WebSocket, name: str, role: str):
        self.connections[user_id] = ws
        self.user_info[user_id] = {"id": user_id, "name": name, "role": role}

    def remove_user(self, user_id: int):
        self.connections.pop(user_id, None)
        self.user_info.pop(user_id, None)

    @property
    def members(self) -> list[dict]:
        return list(self.user_info.values())

    def append_transcript(self, chunk: str):
        self.transcript_buffer.append(chunk)
        # Keep last 50 chunks to avoid unbounded growth
        if len(self.transcript_buffer) > 50:
            self.transcript_buffer = self.transcript_buffer[-50:]

    def get_transcript(self) -> str:
        return " ".join(self.transcript_buffer)


class ConnectionManager:
    """Global manager across all rooms."""

    def __init__(self):
        self._rooms: dict[str, RoomState] = {}
        self._lock = asyncio.Lock()

    def _get_or_create_room(self, room_token: str) -> RoomState:
        if room_token not in self._rooms:
            self._rooms[room_token] = RoomState(room_token)
        return self._rooms[room_token]

    async def connect(
        self,
        websocket: WebSocket,
        room_token: str,
        user_id: int,
        name: str,
        role: str,
    ) -> RoomState:
        await websocket.accept()
        async with self._lock:
            room = self._get_or_create_room(room_token)
            room.add_user(user_id, websocket, name, role)
        return room

    async def disconnect(self, room_token: str, user_id: int):
        async with self._lock:
            room = self._rooms.get(room_token)
            if room:
                room.remove_user(user_id)
                if not room.connections:
                    del self._rooms[room_token]

    async def send_to_user(self, room_token: str, user_id: int, event: dict):
        room = self._rooms.get(room_token)
        if room and user_id in room.connections:
            ws = room.connections[user_id]
            try:
                await ws.send_text(json.dumps(event))
            except Exception:
                pass  # Client disconnected mid-send

    async def broadcast(self, room_token: str, event: dict, exclude_user: int | None = None):
        """Send an event to all users in a room (optionally excluding one)."""
        room = self._rooms.get(room_token)
        if not room:
            return
        dead_connections: list[int] = []
        for uid, ws in room.connections.items():
            if uid == exclude_user:
                continue
            try:
                await ws.send_text(json.dumps(event))
            except Exception:
                dead_connections.append(uid)

        # Clean up any dead connections found during broadcast
        for uid in dead_connections:
            room.remove_user(uid)

    def get_room(self, room_token: str) -> RoomState | None:
        return self._rooms.get(room_token)


# Singleton instance — import this everywhere
manager = ConnectionManager()

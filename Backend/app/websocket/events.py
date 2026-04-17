"""
WebSocket Event Schema
======================
All events follow the structure:
  { "type": EVENT_TYPE, "payload": {...}, "sender_id": int, "room": str }

CLIENT → SERVER events:
  join_room        - user joins a session room
  leave_room       - user leaves a session room
  code_update      - tutor/student updates shared code buffer
  run_code         - request to execute the current code buffer
  chat_message     - plain text chat in session
  transcript_chunk - send a spoken text chunk to build cognitive anchor

SERVER → CLIENT events:
  room_joined      - confirmation + current room state
  user_joined      - another user joined the room
  user_left        - a user left the room
  code_updated     - broadcast updated code to all room members
  code_result      - execution result broadcast
  chat_message     - broadcast chat message
  concept_graph    - updated knowledge graph nodes/edges
  error            - error message
"""

# StrEnum was added in Python 3.11 — use this backport for 3.10
from enum import Enum


class EventType(str, Enum):
    # Client → Server
    JOIN_ROOM = "join_room"
    LEAVE_ROOM = "leave_room"
    CODE_UPDATE = "code_update"
    RUN_CODE = "run_code"
    CHAT_MESSAGE = "chat_message"
    TRANSCRIPT_CHUNK = "transcript_chunk"

    # Server → Client
    ROOM_JOINED = "room_joined"
    USER_JOINED = "user_joined"
    USER_LEFT = "user_left"
    CODE_UPDATED = "code_updated"
    CODE_RESULT = "code_result"
    CONCEPT_GRAPH = "concept_graph"
    ERROR = "error"


def make_event(event_type: EventType, payload: dict, sender_id=None) -> dict:
    """Helper to construct a well-typed event dict."""
    return {
        "type": str(event_type.value),
        "payload": payload,
        "sender_id": sender_id,
    }

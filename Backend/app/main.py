"""
Athira Tutoring Platform — FastAPI entry point
"""
import sys
import json
import asyncio
from contextlib import asynccontextmanager

# ── Windows fix: asyncio subprocesses require ProactorEventLoop ───────────────
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends, Query
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.database import init_db
from app.routers import auth, sessions, workspace
from app.models.user import User
from app.models.session import Session, SessionStatus
from app.services.auth_service import decode_token
from app.services.code_executor import execute_code
from app.services.ai_service import extract_concept_graph
from app.websocket.manager import manager
from app.websocket.events import EventType, make_event
from app.database import AsyncSessionLocal
from sqlalchemy import select

settings = get_settings()


# ─── Lifespan ─────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


# ─── App ──────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="Athira Tutoring API",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── REST Routers ─────────────────────────────────────────────────────────────

app.include_router(auth.router)
app.include_router(sessions.router)
app.include_router(workspace.router)


@app.get("/health")
async def health():
    return {"status": "ok"}


# ─── WebSocket ────────────────────────────────────────────────────────────────

@app.websocket("/ws/{room_token}")
async def websocket_endpoint(
    websocket: WebSocket,
    room_token: str,
    token: str = Query(..., description="JWT access token"),
):
    # ── Auth ──────────────────────────────────────────────────────────────────
    try:
        payload = decode_token(token)
        user_id = int(payload["sub"])
    except Exception:
        await websocket.close(code=4001, reason="Invalid token")
        return

    # ── Validate room & participant ───────────────────────────────────────────
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Session).where(Session.room_token == room_token)
        )
        session = result.scalar_one_or_none()

        if not session or session.status not in (
            SessionStatus.accepted, SessionStatus.in_progress
        ):
            await websocket.close(code=4004, reason="Room not found or inactive")
            return

        if user_id not in (session.student_id, session.tutor_id):
            await websocket.close(code=4003, reason="Not a participant")
            return

        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        if not user:
            await websocket.close(code=4001, reason="User not found")
            return

    # ── Connect ───────────────────────────────────────────────────────────────
    room = await manager.connect(
        websocket, room_token, user.id, user.name, user.role
    )

    await manager.send_to_user(
        room_token, user.id,
        make_event(EventType.ROOM_JOINED, {
            "members": room.members,
            "shared_code": room.shared_code,
            "shared_language": room.shared_language,
        }, sender_id=None)
    )

    await manager.broadcast(
        room_token,
        make_event(EventType.USER_JOINED, {"user": {"id": user.id, "name": user.name, "role": user.role}}, sender_id=user.id),
        exclude_user=user.id,
    )

    # ── Message loop ──────────────────────────────────────────────────────────
    try:
        while True:
            raw = await websocket.receive_text()
            try:
                event = json.loads(raw)
            except json.JSONDecodeError:
                await manager.send_to_user(
                    room_token, user.id,
                    make_event(EventType.ERROR, {"detail": "Invalid JSON"})
                )
                continue

            event_type = event.get("type")
            payload = event.get("payload", {})

            # ── code_update ───────────────────────────────────────────────────
            if event_type == EventType.CODE_UPDATE:
                room.shared_code = payload.get("code", room.shared_code)
                room.shared_language = payload.get("language", room.shared_language)
                await manager.broadcast(
                    room_token,
                    make_event(EventType.CODE_UPDATED, {
                        "code": room.shared_code,
                        "language": room.shared_language,
                    }, sender_id=user.id),
                    exclude_user=user.id,
                )

            # ── run_code ──────────────────────────────────────────────────────
            elif event_type == EventType.RUN_CODE:
                code = payload.get("code", room.shared_code)
                language = payload.get("language", room.shared_language)
                try:
                    result = await execute_code(code, language)
                    await manager.broadcast(
                        room_token,
                        make_event(EventType.CODE_RESULT, {
                            "stdout": result.stdout,
                            "stderr": result.stderr,
                            "exit_code": result.exit_code,
                            "timed_out": result.timed_out,
                            "language": result.language,
                        }, sender_id=user.id),
                    )
                except Exception as e:
                    await manager.send_to_user(
                        room_token, user.id,
                        make_event(EventType.CODE_RESULT, {
                            "stdout": "",
                            "stderr": f"Execution error: {str(e)}",
                            "exit_code": 1,
                            "timed_out": False,
                            "language": language,
                        }, sender_id=user.id)
                    )

            # ── chat_message ──────────────────────────────────────────────────
            elif event_type == EventType.CHAT_MESSAGE:
                await manager.broadcast(
                    room_token,
                    make_event(EventType.CHAT_MESSAGE, {
                        "text": payload.get("text", ""),
                        "sender": {"id": user.id, "name": user.name},
                    }, sender_id=user.id),
                )

            # ── transcript_chunk ──────────────────────────────────────────────
            elif event_type == EventType.TRANSCRIPT_CHUNK:
                chunk = payload.get("text", "").strip()
                if chunk:
                    room.append_transcript(chunk)
                    if len(room.transcript_buffer) % 5 == 0:
                        graph = await extract_concept_graph(room.get_transcript())
                        await manager.broadcast(
                            room_token,
                            make_event(EventType.CONCEPT_GRAPH, graph, sender_id=None),
                        )

            # ── leave_room ────────────────────────────────────────────────────
            elif event_type == EventType.LEAVE_ROOM:
                break

    except WebSocketDisconnect:
        pass
    finally:
        await manager.disconnect(room_token, user.id)
        await manager.broadcast(
            room_token,
            make_event(EventType.USER_LEFT, {
                "user": {"id": user.id, "name": user.name}
            }, sender_id=user.id),
        )

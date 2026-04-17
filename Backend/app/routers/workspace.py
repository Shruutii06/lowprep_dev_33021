"""
Workspace router — code execution + AI concept graph (REST endpoints).
The real-time collaborative layer lives in the WebSocket handler (main.py).
"""
from typing import Literal
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models.user import User
from app.models.session import Session, SessionStatus
from app.services.auth_service import get_current_user
from app.services.code_executor import execute_code, ExecutionResult
from app.services.ai_service import extract_concept_graph

router = APIRouter(prefix="/api/workspace", tags=["workspace"])


# ─── Schemas ──────────────────────────────────────────────────────────────────

class RunCodeRequest(BaseModel):
    code: str
    language: Literal["python", "javascript"] = "python"


class RunCodeResponse(BaseModel):
    stdout: str
    stderr: str
    exit_code: int
    timed_out: bool
    language: str


class ConceptGraphRequest(BaseModel):
    transcript: str


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.post("/{room_token}/run", response_model=RunCodeResponse)
async def run_code(
    room_token: str,
    body: RunCodeRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Execute code for a session room.
    Validates the caller is a participant of the session that owns the room token.
    """
    await _assert_room_participant(room_token, current_user, db)

    result: ExecutionResult = await execute_code(body.code, body.language)
    return RunCodeResponse(
        stdout=result.stdout,
        stderr=result.stderr,
        exit_code=result.exit_code,
        timed_out=result.timed_out,
        language=result.language,
    )


@router.post("/{room_token}/concept-graph")
async def concept_graph(
    room_token: str,
    body: ConceptGraphRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Extract a concept knowledge graph from a transcript snippet using Claude AI.
    Returns {"nodes": [...], "edges": [...]}.
    """
    await _assert_room_participant(room_token, current_user, db)

    if not body.transcript.strip():
        raise HTTPException(status_code=400, detail="Transcript cannot be empty")

    graph = await extract_concept_graph(body.transcript)
    return graph


# ─── Helper ───────────────────────────────────────────────────────────────────

async def _assert_room_participant(room_token: str, user: User, db: AsyncSession):
    result = await db.execute(
        select(Session).where(Session.room_token == room_token)
    )
    session = result.scalar_one_or_none()

    if not session:
        raise HTTPException(status_code=404, detail="Room not found")

    if session.status not in (SessionStatus.accepted, SessionStatus.in_progress):
        raise HTTPException(status_code=400, detail="Session room is not active")

    if user.id not in (session.student_id, session.tutor_id):
        raise HTTPException(status_code=403, detail="You are not a participant of this session")

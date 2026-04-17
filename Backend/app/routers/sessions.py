"""
Sessions Router — full CRUD for tutoring sessions.

Endpoints:
  POST   /api/sessions/               → student creates a session request
  GET    /api/sessions/               → list sessions (role-aware)
  GET    /api/sessions/{id}           → get single session
  POST   /api/sessions/{id}/accept    → tutor accepts a pending session
  POST   /api/sessions/{id}/complete  → mark session as completed
  DELETE /api/sessions/{id}           → student cancels their own session
"""
import secrets
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.user import User, UserRole
from app.models.session import Session, SessionStatus
from app.schemas.session import SessionCreate, SessionOut, SessionAccept
from app.services.auth_service import get_current_user

router = APIRouter(prefix="/api/sessions", tags=["sessions"])


# ─── Helper: load session with relationships ──────────────────────────────────

async def _get_session_or_404(session_id: int, db: AsyncSession) -> Session:
    result = await db.execute(
        select(Session)
        .options(selectinload(Session.student), selectinload(Session.tutor))
        .where(Session.id == session_id)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session


# ─── Create ───────────────────────────────────────────────────────────────────

@router.post("/", response_model=SessionOut, status_code=status.HTTP_201_CREATED)
async def create_session(
    data: SessionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Student creates a new tutoring session request."""
    if current_user.role != UserRole.student:
        raise HTTPException(
            status_code=403,
            detail="Only students can create session requests"
        )

    session = Session(
        student_id=current_user.id,
        subject=data.subject,
        description=data.description,
        scheduled_at=data.scheduled_at,
        status=SessionStatus.pending,
    )
    db.add(session)
    await db.flush()
    await db.refresh(session, ["student", "tutor"])
    return SessionOut.model_validate(session)


# ─── List ─────────────────────────────────────────────────────────────────────

@router.get("/", response_model=List[SessionOut])
async def list_sessions(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Return sessions relevant to the current user.
    - Students see their own sessions.
    - Tutors see their accepted sessions + all pending sessions they can pick up.
    """
    if current_user.role == UserRole.student:
        stmt = (
            select(Session)
            .options(selectinload(Session.student), selectinload(Session.tutor))
            .where(Session.student_id == current_user.id)
            .order_by(Session.created_at.desc())
        )
    else:  # tutor
        stmt = (
            select(Session)
            .options(selectinload(Session.student), selectinload(Session.tutor))
            .where(
                (Session.tutor_id == current_user.id) |
                (Session.status == SessionStatus.pending)
            )
            .order_by(Session.created_at.desc())
        )

    result = await db.execute(stmt)
    sessions = result.scalars().all()
    return [SessionOut.model_validate(s) for s in sessions]


# ─── Get single ───────────────────────────────────────────────────────────────

@router.get("/{session_id}", response_model=SessionOut)
async def get_session(
    session_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    session = await _get_session_or_404(session_id, db)

    # Access control: only participants or tutors browsing pending sessions
    is_participant = current_user.id in (session.student_id, session.tutor_id)
    is_tutor_viewing_pending = (
        current_user.role == UserRole.tutor and
        session.status == SessionStatus.pending
    )
    if not is_participant and not is_tutor_viewing_pending:
        raise HTTPException(status_code=403, detail="Access denied")

    return SessionOut.model_validate(session)


# ─── Accept ───────────────────────────────────────────────────────────────────

@router.post("/{session_id}/accept", response_model=SessionOut)
async def accept_session(
    session_id: int,
    data: SessionAccept,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Tutor accepts a pending session. Generates a room_token."""
    if current_user.role != UserRole.tutor:
        raise HTTPException(status_code=403, detail="Only tutors can accept sessions")

    session = await _get_session_or_404(session_id, db)

    if session.status != SessionStatus.pending:
        raise HTTPException(
            status_code=400,
            detail=f"Session is already {session.status.value}, cannot accept"
        )

    session.tutor_id = current_user.id
    session.status = SessionStatus.accepted
    session.room_token = secrets.token_urlsafe(32)
    if data.scheduled_at:
        session.scheduled_at = data.scheduled_at

    await db.flush()
    await db.refresh(session, ["student", "tutor"])
    return SessionOut.model_validate(session)


# ─── Start / Complete ─────────────────────────────────────────────────────────

@router.post("/{session_id}/complete", response_model=SessionOut)
async def complete_session(
    session_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Mark a session as completed. Only participants can do this."""
    session = await _get_session_or_404(session_id, db)

    if current_user.id not in (session.student_id, session.tutor_id):
        raise HTTPException(status_code=403, detail="Not a participant")

    if session.status not in (SessionStatus.accepted, SessionStatus.in_progress):
        raise HTTPException(
            status_code=400,
            detail="Only active sessions can be marked as completed"
        )

    session.status = SessionStatus.completed
    await db.flush()
    await db.refresh(session, ["student", "tutor"])
    return SessionOut.model_validate(session)


# ─── Cancel ───────────────────────────────────────────────────────────────────

@router.delete("/{session_id}", response_model=SessionOut)
async def cancel_session(
    session_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Student cancels their own pending session."""
    session = await _get_session_or_404(session_id, db)

    if session.student_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the student can cancel their session")

    if session.status not in (SessionStatus.pending, SessionStatus.accepted):
        raise HTTPException(
            status_code=400,
            detail="Cannot cancel a session that is already in progress or completed"
        )

    session.status = SessionStatus.cancelled
    await db.flush()
    await db.refresh(session, ["student", "tutor"])
    return SessionOut.model_validate(session)

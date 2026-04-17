from sqlalchemy import Column, Integer, String, Enum, DateTime, ForeignKey, Text, func
from sqlalchemy.orm import relationship
import enum

from app.database import Base


class SessionStatus(str, enum.Enum):
    pending = "pending"
    accepted = "accepted"
    in_progress = "in_progress"
    completed = "completed"
    cancelled = "cancelled"


class Session(Base):
    __tablename__ = "sessions"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    tutor_id = Column(Integer, ForeignKey("users.id"), nullable=True)  # null until accepted
    subject = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    scheduled_at = Column(DateTime(timezone=True), nullable=True)
    status = Column(Enum(SessionStatus), default=SessionStatus.pending, nullable=False)
    room_token = Column(String(64), unique=True, nullable=True)   # generated on accept
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    student = relationship("User", foreign_keys=[student_id], back_populates="sessions_as_student")
    tutor = relationship("User", foreign_keys=[tutor_id], back_populates="sessions_as_tutor")

from sqlalchemy import Column, Integer, String, Enum, DateTime, func
from sqlalchemy.orm import relationship
import enum

from app.database import Base


class UserRole(str, enum.Enum):
    student = "student"
    tutor = "tutor"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    role = Column(Enum(UserRole), nullable=False, default=UserRole.student)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    sessions_as_student = relationship(
        "Session", foreign_keys="Session.student_id", back_populates="student"
    )
    sessions_as_tutor = relationship(
        "Session", foreign_keys="Session.tutor_id", back_populates="tutor"
    )

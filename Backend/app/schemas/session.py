from pydantic import BaseModel
from datetime import datetime
from typing import Optional
from app.models.session import SessionStatus
from app.schemas.user import UserOut


class SessionCreate(BaseModel):
    subject: str
    description: Optional[str] = None
    scheduled_at: Optional[datetime] = None


class SessionOut(BaseModel):
    id: int
    subject: str
    description: Optional[str]
    scheduled_at: Optional[datetime]
    status: SessionStatus
    room_token: Optional[str]
    student: UserOut
    tutor: Optional[UserOut]
    created_at: datetime

    model_config = {"from_attributes": True}


class SessionAccept(BaseModel):
    scheduled_at: Optional[datetime] = None

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class TeamCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)


class TeamInvite(BaseModel):
    email: EmailStr
    role: str = Field(default="viewer", pattern="^(owner|editor|viewer)$")


class TeamMemberOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    user_id: uuid.UUID
    email: str
    name: str = ""
    role: str


class TeamOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    owner_id: uuid.UUID
    members: list[TeamMemberOut] = []
    created_at: datetime

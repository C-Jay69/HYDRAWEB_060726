import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class ProjectCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    description: str = Field(default="", max_length=2000)
    visibility: str = Field(default="private", pattern="^(public|private)$")
    prompt: str = Field(default="", max_length=20000)
    tech_preferences: dict = Field(default_factory=dict)


class ProjectUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    description: str | None = Field(default=None, max_length=2000)
    visibility: str | None = Field(default=None, pattern="^(public|private)$")
    prompt: str | None = Field(default=None, max_length=20000)


class VersionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    version: int
    message: str
    created_at: datetime


class VersionDetail(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    project_id: uuid.UUID
    version: int
    message: str
    html: str = ""
    css: str = ""
    js: str = ""
    backend: dict = {}
    db_schema: str = ""
    files: dict = {}
    created_at: datetime


class ProjectOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    description: str = ""
    visibility: str = "private"
    slug: str
    prompt: str = ""
    tech_preferences: dict = {}
    status: str = "draft"
    latest_version: int = 0
    created_at: datetime
    updated_at: datetime


class GenerateRequest(BaseModel):
    prompt: str = Field(min_length=3, max_length=20000)
    include_backend: bool = True
    include_db: bool = True
    model: str | None = None


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=20000)


class ApplySuggestion(BaseModel):
    suggestion_id: uuid.UUID | None = None
    html: str | None = None
    css: str | None = None
    js: str | None = None
    backend: dict | None = None
    db_schema: str | None = None
    message: str = Field(default="", max_length=300)


class ChatMessageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    role: str
    content: str
    suggestion: dict = {}
    created_at: datetime


class DeployRequest(BaseModel):
    subdomain: str = Field(pattern=r"^[a-z0-9]([a-z0-9-]{0,60}[a-z0-9])?$")
    env_vars: dict = Field(default_factory=dict)


class DeploymentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    project_id: uuid.UUID
    version: int
    subdomain: str
    status: str
    target_url: str
    created_at: datetime

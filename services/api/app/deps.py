"""Shared FastAPI dependencies: auth, API keys, admin, plan helpers."""

import hashlib
import uuid
from datetime import UTC, datetime

from fastapi import Depends, Header, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .config import settings
from .database import get_db
from .models import ApiKey, Project, Subscription, User
from .security import decode_token
from .services.rate_limit import check_rate_limit


class InvalidCredentials(HTTPException):
    def __init__(self, detail: str = "Invalid authentication credentials"):
        super().__init__(status_code=401, detail=detail, headers={"WWW-Authenticate": "Bearer"})


async def resolve_identity(
    db: AsyncSession,
    authorization: str | None,
    x_api_key: str | None,
) -> tuple[User, str]:
    """Resolve a user from a Bearer token or platform API key.

    Returns (user, rate_key) where rate_key uniquely identifies the caller.
    """
    if x_api_key:
        key_hash = hashlib.sha256(x_api_key.encode()).hexdigest()
        result = await db.execute(select(ApiKey).where(ApiKey.key_hash == key_hash))
        api_key = result.scalar_one_or_none()
        if api_key is None or not api_key.enabled:
            raise InvalidCredentials("Invalid API key")
        result = await db.execute(select(User).where(User.id == api_key.user_id))
        user = result.scalar_one_or_none()
        if user is None:
            raise InvalidCredentials()
        if user.is_banned:
            raise HTTPException(status_code=403, detail="This account has been suspended.")
        api_key.last_used_at = datetime.now(UTC)
        await db.flush()
        return user, f"key:{api_key.id}"

    if not authorization or not authorization.startswith("Bearer "):
        raise InvalidCredentials()
    token = authorization[7:].strip()
    try:
        payload = decode_token(token)
    except Exception as exc:
        raise InvalidCredentials() from exc
    try:
        user_id = uuid.UUID(payload.get("sub", ""))
    except ValueError as exc:
        raise InvalidCredentials() from exc
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise InvalidCredentials()
    return user, f"user:{user.id}"


async def _ensure_active(user: User) -> None:
    if user.is_banned:
        raise HTTPException(status_code=403, detail="This account has been suspended.")


async def user_plan(db: AsyncSession, user: User) -> str:
    result = await db.execute(select(Subscription).where(Subscription.user_id == user.id))
    sub = result.scalar_one_or_none()
    if sub and sub.plan_tier in ("pro", "enterprise") and sub.status == "active":
        return sub.plan_tier
    return "free"


async def rate_limited_user(
    request: Request,
    db: AsyncSession = Depends(get_db),
    authorization: str | None = Header(default=None),
    x_api_key: str | None = Header(default=None),
) -> User:
    user, rate_key = await resolve_identity(db, authorization, x_api_key)
    await _ensure_active(user)
    plan = await user_plan(db, user)
    allowed = await check_rate_limit(f"{rate_key}:{request.url.path}", settings.rate_limit_for(plan))
    if not allowed:
        raise HTTPException(status_code=429, detail="Rate limit exceeded. Upgrade your plan for higher limits.")
    return user


async def require_admin(user: User = Depends(rate_limited_user)) -> User:
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


async def get_project_or_404(db: AsyncSession, project_id: uuid.UUID, user: User) -> Project:
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")
    if project.user_id != user.id:
        raise HTTPException(status_code=403, detail="You do not have access to this project")
    return project

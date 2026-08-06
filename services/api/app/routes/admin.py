"""Admin analytics and moderation endpoints (role-gated)."""

import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..deps import require_admin
from ..models import ApiKey, Deployment, LlmUsage, OneTimePayment, Project, Team, User
from ..schemas.admin import AdminStats

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/stats", response_model=AdminStats)
async def admin_stats(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    users = await db.scalar(select(func.count(User.id))) or 0
    projects = await db.scalar(select(func.count(Project.id))) or 0
    deployments = await db.scalar(select(func.count(Deployment.id))) or 0
    api_keys = await db.scalar(select(func.count(ApiKey.id))) or 0
    teams = await db.scalar(select(func.count(Team.id))) or 0
    llm_calls = await db.scalar(select(func.count(LlmUsage.id))) or 0
    llm_total_tokens = await db.scalar(select(func.coalesce(func.sum(LlmUsage.total_tokens), 0))) or 0

    one_time_revenue = (
        await db.scalar(select(func.coalesce(func.sum(OneTimePayment.amount), 0))) or 0
    )
    revenue = one_time_revenue

    week_ago = datetime.now(timezone.utc) - timedelta(days=7)
    signups_7d = (
        await db.scalar(select(func.count(User.id)).where(User.created_at >= week_ago)) or 0
    )
    projects_7d = (
        await db.scalar(select(func.count(Project.id)).where(Project.created_at >= week_ago)) or 0
    )

    return AdminStats(
        users=users,
        projects=projects,
        deployments=deployments,
        api_keys=api_keys,
        teams=teams,
        llm_calls=llm_calls,
        llm_total_tokens=llm_total_tokens,
        revenue_cents=revenue,
        one_time_revenue_cents=one_time_revenue,
        signups_last_7_days=signups_7d,
        projects_last_7_days=projects_7d,
    )


@router.patch("/users/{user_id}", response_model=dict)
async def moderate_user(
    user_id: uuid.UUID,
    body: dict,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    user = await db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    if user.role == "admin" and body.get("banned"):
        raise HTTPException(status_code=400, detail="Cannot ban an admin.")
    if "banned" in body:
        user.is_banned = bool(body["banned"])
    if "role" in body and body["role"] in ("user", "admin"):
        user.role = body["role"]
    await db.commit()
    return {"id": str(user.id), "email": user.email, "banned": user.is_banned, "role": user.role}


@router.get("/users", response_model=list[dict])
async def admin_users(db: AsyncSession = Depends(get_db), _: User = Depends(require_admin)):
    result = await db.execute(select(User).order_by(User.created_at.desc()).limit(200))
    return [
        {
            "id": str(u.id),
            "email": u.email,
            "name": u.name,
            "role": u.role,
            "banned": u.is_banned,
            "created_at": u.created_at,
        }
        for u in result.scalars().all()
    ]

"""Admin analytics and moderation endpoints (role-gated)."""

import uuid
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..deps import require_admin
from ..models import ApiKey, Deployment, LlmUsage, OneTimePayment, Project, Subscription, Team, User
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

    week_ago = datetime.now(UTC) - timedelta(days=7)
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


@router.get("/projects", response_model=list[dict])
async def admin_projects(db: AsyncSession = Depends(get_db), _: User = Depends(require_admin)):
    result = await db.execute(
        select(Project, User.email, User.name)
        .join(User, User.id == Project.user_id)
        .order_by(Project.updated_at.desc())
        .limit(200)
    )
    return [
        {
            "id": str(p.id),
            "name": p.name,
            "slug": p.slug,
            "status": p.status,
            "latest_version": p.latest_version,
            "visibility": p.visibility,
            "owner_email": email,
            "owner_name": name,
            "created_at": p.created_at,
            "updated_at": p.updated_at,
        }
        for p, email, name in result.all()
    ]


@router.get("/usage", response_model=list[dict])
async def admin_usage(db: AsyncSession = Depends(get_db), _: User = Depends(require_admin)):
    result = await db.execute(
        select(LlmUsage, User.email)
        .join(User, User.id == LlmUsage.user_id, isouter=True)
        .order_by(LlmUsage.created_at.desc())
        .limit(100)
    )
    return [
        {
            "id": str(u.id),
            "email": email,
            "model": u.model,
            "endpoint": u.endpoint,
            "prompt_tokens": u.prompt_tokens,
            "completion_tokens": u.completion_tokens,
            "total_tokens": u.total_tokens,
            "cost_estimate": u.cost_estimate,
            "cached": u.cached,
            "created_at": u.created_at,
        }
        for u, email in result.all()
    ]


@router.get("/payments", response_model=list[dict])
async def admin_payments(db: AsyncSession = Depends(get_db), _: User = Depends(require_admin)):
    result = await db.execute(
        select(OneTimePayment, User.email)
        .join(User, User.id == OneTimePayment.user_id, isouter=True)
        .order_by(OneTimePayment.created_at.desc())
        .limit(100)
    )
    return [
        {
            "id": str(p.id),
            "email": email,
            "amount": p.amount,
            "currency": p.currency,
            "product_name": p.product_name,
            "stripe_payment_intent_id": p.stripe_payment_intent_id,
            "created_at": p.created_at,
        }
        for p, email in result.all()
    ]


@router.get("/subscriptions", response_model=list[dict])
async def admin_subscriptions(db: AsyncSession = Depends(get_db), _: User = Depends(require_admin)):
    result = await db.execute(
        select(Subscription, User.email)
        .join(User, User.id == Subscription.user_id)
        .order_by(Subscription.updated_at.desc())
        .limit(200)
    )
    return [
        {
            "id": str(s.id),
            "email": email,
            "plan_tier": s.plan_tier,
            "status": s.status,
            "billing_cycle": s.billing_cycle,
            "current_period_end": s.current_period_end,
            "stripe_subscription_id": s.stripe_subscription_id,
            "updated_at": s.updated_at,
        }
        for s, email in result.all()
    ]

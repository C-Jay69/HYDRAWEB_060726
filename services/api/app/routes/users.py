"""User profile, API keys, and subscription endpoints."""

import hashlib
import secrets
import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import settings
from ..database import get_db
from ..deps import rate_limited_user, user_plan
from ..models import ApiKey, User
from ..schemas.auth import ProfileUpdate, UserPublic
from ..schemas.billing import ApiKeyCreated, ApiKeyCreate, ApiKeyOut, SubscriptionOut

router = APIRouter(tags=["users"])


async def _user_public(user: User, plan: str) -> UserPublic:
    return UserPublic(
        id=user.id,
        email=user.email,
        name=user.name,
        avatar_url=user.avatar_url,
        bio=user.bio,
        social_links=user.social_links or {},
        role=user.role,
        is_verified=user.is_verified,
        created_at=user.created_at,
        last_login=user.last_login,
        plan=plan,
    )


@router.get("/users/me", response_model=UserPublic)
async def get_me(user: User = Depends(rate_limited_user), db: AsyncSession = Depends(get_db)):
    plan = await user_plan(db, user)
    return await _user_public(user, plan)


@router.patch("/users/me", response_model=UserPublic)
async def update_me(
    body: ProfileUpdate,
    user: User = Depends(rate_limited_user),
    db: AsyncSession = Depends(get_db),
):
    if body.name is not None:
        user.name = body.name.strip()
    if body.bio is not None:
        user.bio = body.bio
    if body.avatar_url is not None:
        user.avatar_url = str(body.avatar_url)
    if body.social_links is not None:
        user.social_links = body.social_links
    await db.commit()
    await db.refresh(user)
    plan = await user_plan(db, user)
    return await _user_public(user, plan)


@router.get("/users/me/api-keys", response_model=list[ApiKeyOut])
async def list_api_keys(user: User = Depends(rate_limited_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ApiKey).where(ApiKey.user_id == user.id).order_by(ApiKey.created_at.desc()))
    return result.scalars().all()


@router.post("/users/me/api-keys", response_model=ApiKeyCreated, status_code=201)
async def create_api_key(
    body: ApiKeyCreate,
    user: User = Depends(rate_limited_user),
    db: AsyncSession = Depends(get_db),
):
    plan = await user_plan(db, user)
    raw = f"hw_{secrets.token_urlsafe(32)}"
    api_key = ApiKey(
        user_id=user.id,
        name=body.name,
        prefix=raw[:11],
        key_hash=hashlib.sha256(raw.encode()).hexdigest(),
        rate_limit=settings.rate_limit_for(plan),
    )
    db.add(api_key)
    await db.commit()
    await db.refresh(api_key)
    return ApiKeyCreated(id=api_key.id, name=api_key.name, key=raw, prefix=api_key.prefix)


@router.delete("/users/me/api-keys/{key_id}", status_code=204)
async def delete_api_key(key_id: uuid.UUID, user: User = Depends(rate_limited_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ApiKey).where(ApiKey.id == key_id, ApiKey.user_id == user.id))
    api_key = result.scalar_one_or_none()
    if api_key is None:
        raise HTTPException(status_code=404, detail="API key not found")
    await db.delete(api_key)
    await db.commit()


@router.get("/users/me/subscription", response_model=SubscriptionOut)
async def get_subscription(user: User = Depends(rate_limited_user), db: AsyncSession = Depends(get_db)):
    from ..models import Subscription

    result = await db.execute(select(Subscription).where(Subscription.user_id == user.id))
    sub = result.scalar_one_or_none()
    if sub is None:
        sub = Subscription(user_id=user.id, plan_tier="free", status="active")
        db.add(sub)
        await db.commit()
        await db.refresh(sub)
    return sub

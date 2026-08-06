"""Seed the database with an admin user and a demo account.

Usage: python -m app.seed
"""

import asyncio
import logging

from sqlalchemy import select

from .config import settings
from .database import SessionLocal
from .models import Subscription, User
from .security import hash_password

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("hydraweb.seed")


async def _ensure_user(email: str, name: str, password: str, role: str) -> User:
    async with SessionLocal() as db:
        result = await db.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()
        if user:
            logger.info("User %s already exists", email)
            return user
        user = User(
            email=email,
            name=name,
            password_hash=hash_password(password),
            role=role,
            is_verified=True,
        )
        db.add(user)
        await db.flush()
        db.add(Subscription(user_id=user.id, plan_tier="free", status="active"))
        await db.commit()
        logger.info("Created %s user %s", role, email)
        return user


async def seed() -> None:
    admin_email = (settings.admin_emails.split(",")[0] if settings.admin_emails else "admin@myplatform.dev").strip()
    await _ensure_user(admin_email, "HydraWeb Admin", "admin-password-change-me", "admin")
    await _ensure_user("demo@myplatform.dev", "Demo User", "demo-password-change-me", "user")


if __name__ == "__main__":
    asyncio.run(seed())

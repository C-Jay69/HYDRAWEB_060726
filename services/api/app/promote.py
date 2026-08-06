"""Promote an existing user to admin: `uv run python -m app.promote user@example.com`."""

import asyncio
import sys

from sqlalchemy import select

from .database import SessionLocal
from .models import User


async def promote(email: str) -> None:
    async with SessionLocal() as db:
        result = await db.execute(select(User).where(User.email == email.lower()))
        user = result.scalar_one_or_none()
        if user is None:
            print(f"No user found with email {email}")
            return
        user.role = "admin"
        await db.commit()
        print(f"Promoted {user.email} to admin")


def main() -> None:
    if len(sys.argv) != 2:
        print("Usage: uv run python -m app.promote <email>")
        sys.exit(1)
    asyncio.run(promote(sys.argv[1]))


if __name__ == "__main__":
    main()

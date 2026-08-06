"""Redis-backed sliding-window rate limiting with graceful degradation."""

import redis.asyncio as aioredis

from ..config import settings

_client: aioredis.Redis | None = None


async def get_redis() -> aioredis.Redis:
    global _client
    if _client is None:
        _client = aioredis.from_url(settings.redis_url, decode_responses=True)
    return _client


async def check_rate_limit(key: str, limit: int, window: int = 60) -> bool:
    """Return True when the request is allowed."""
    if not settings.rate_limit_enabled:
        return True
    try:
        r = await get_redis()
        count = await r.incr(f"rl:{key}")
        if count == 1:
            await r.expire(f"rl:{key}", window)
        return count <= limit
    except Exception:
        # Redis unavailable: fail open to avoid taking the platform down.
        return True


async def cache_get(key: str) -> str | None:
    try:
        r = await get_redis()
        return await r.get(key)
    except Exception:
        return None


async def cache_set(key: str, value: str, ttl: int = 3600) -> None:
    try:
        r = await get_redis()
        await r.set(key, value, ex=ttl)
    except Exception:
        pass

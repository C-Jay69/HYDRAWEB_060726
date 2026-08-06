"""LLM orchestration: OpenRouter calls, caching, streaming, usage tracking."""

import hashlib
import json
import logging
from collections.abc import AsyncGenerator

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import settings
from ..models import LlmUsage, Project, User
from ..services.rate_limit import cache_get, cache_set
from .context import estimate_tokens, truncate_messages
from .mock import get_sample_site
from .prompts import build_generate_messages, build_refine_messages

logger = logging.getLogger("hydraweb.llm")

# Rough $ per 1K tokens for common OpenRouter models (input, output).
MODEL_PRICES: dict[str, tuple[float, float]] = {
    "openai/gpt-4o": (0.0025, 0.0100),
    "openai/gpt-4o-mini": (0.00015, 0.0006),
    "anthropic/claude-3.5-sonnet": (0.0030, 0.0150),
    "anthropic/claude-3.7-sonnet": (0.0030, 0.0150),
    "meta-llama/llama-3.1-70b-instruct": (0.0005, 0.0010),
    "google/gemini-pro-1.5": (0.00125, 0.00500),
    "google/gemma-4-31b-it:free": (0.0, 0.0),
}


class LLMError(Exception):
    pass


def _headers() -> dict:
    if not settings.openrouter_api_key:
        raise LLMError("LLM provider is not configured. Set OPENROUTER_API_KEY (or LLM_MOCK=true).")
    return {
        "Authorization": f"Bearer {settings.openrouter_api_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": settings.frontend_url,
        "X-Title": "HydraWeb",
    }


def _cost_estimate(model: str, prompt_tokens: int, completion_tokens: int) -> float:
    prices = MODEL_PRICES.get(model, (0.001, 0.003))
    return (prompt_tokens * prices[0] + completion_tokens * prices[1]) / 1000.0


def _extract_balanced_object(text: str) -> str:
    """Return the first top-level balanced JSON object, honoring nested braces inside strings."""
    start = text.find("{")
    if start == -1:
        return ""
    depth = 0
    in_string = False
    escaped = False
    for i in range(start, len(text)):
        c = text[i]
        if in_string:
            if escaped:
                escaped = False
            elif c == "\\":
                escaped = True
            elif c == '"':
                in_string = False
        else:
            if c == '"':
                in_string = True
            elif c == "{":
                depth += 1
            elif c == "}":
                depth -= 1
                if depth == 0:
                    return text[start : i + 1]
    return ""


def _fix_single_quotes(s: str) -> str:
    """Best-effort conversion of single-quoted strings to double-quoted JSON strings."""
    out: list[str] = []
    i = 0
    n = len(s)
    while i < n:
        c = s[i]
        if c == "'":
            j = i + 1
            buf: list[str] = []
            while j < n:
                if s[j] == "\\":
                    buf.append(s[j : j + 2])
                    j += 2
                    continue
                if s[j] == "'":
                    break
                buf.append(s[j])
                j += 1
            if j < n:
                out.append('"' + "".join(buf).replace('"', '\\"') + '"')
                i = j + 1
                continue
        out.append(c)
        i += 1
    return "".join(out)


def extract_json(text: str) -> dict:
    # Strip optional markdown code fences (```json ... ```).
    stripped = text.strip()
    if stripped.startswith("```"):
        inner = stripped.strip("`").strip()
        if inner.lower().startswith("json"):
            inner = inner[4:].lstrip()
        text = inner
    raw = _extract_balanced_object(text)
    if not raw:
        raise LLMError("Model did not return a JSON object.")
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        pass
    try:
        return json.loads(_fix_single_quotes(raw))
    except json.JSONDecodeError as exc:
        raise LLMError(f"Model returned malformed JSON: {exc}") from exc


async def _chat(
    messages: list[dict],
    model: str | None = None,
    temperature: float | None = None,
    max_tokens: int | None = None,
) -> tuple[str, dict | None]:
    model = model or settings.llm_model
    payload = {
        "model": model,
        "messages": messages,
        "temperature": settings.llm_temperature if temperature is None else temperature,
        "max_tokens": settings.llm_max_tokens if max_tokens is None else max_tokens,
    }
    async with httpx.AsyncClient(timeout=240) as client:
        resp = await client.post(f"{settings.openrouter_base_url}/chat/completions", json=payload, headers=_headers())
        if resp.status_code != 200:
            body = resp.text[:500]
            raise LLMError(f"LLM provider error {resp.status_code}: {body}")
        data = resp.json()
    content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
    return content, data.get("usage")


async def _chat_stream(
    messages: list[dict],
    model: str | None = None,
    temperature: float | None = None,
    max_tokens: int | None = None,
) -> AsyncGenerator[str, None]:
    model = model or settings.llm_model
    payload = {
        "model": model,
        "messages": messages,
        "temperature": settings.llm_temperature if temperature is None else temperature,
        "max_tokens": settings.llm_max_tokens if max_tokens is None else max_tokens,
        "stream": True,
        "stream_options": {"include_usage": True},
    }
    async with httpx.AsyncClient(timeout=300) as client:
        async with client.stream(
            "POST", f"{settings.openrouter_base_url}/chat/completions", json=payload, headers=_headers()
        ) as resp:
            if resp.status_code != 200:
                body = (await resp.aread()).decode()[:500]
                raise LLMError(f"LLM provider error {resp.status_code}: {body}")
            async for line in resp.aiter_lines():
                if not line.startswith("data: "):
                    continue
                data = line[6:].strip()
                if data == "[DONE]":
                    break
                try:
                    chunk = json.loads(data)
                except json.JSONDecodeError:
                    continue
                if chunk.get("usage"):
                    yield f"__USAGE__:{json.dumps(chunk['usage'])}"
                    continue
                choices = chunk.get("choices") or []
                if choices:
                    delta = choices[0].get("delta", {}).get("content")
                    if delta:
                        yield delta


async def record_usage(
    db: AsyncSession,
    user: User | None,
    project: Project | None,
    model: str,
    endpoint: str,
    usage: dict | None,
    cached: bool = False,
) -> None:
    prompt_tokens = int((usage or {}).get("prompt_tokens", 0))
    completion_tokens = int((usage or {}).get("completion_tokens", 0))
    if not prompt_tokens and not completion_tokens:
        return
    db.add(
        LlmUsage(
            user_id=user.id if user else None,
            project_id=project.id if project else None,
            model=model,
            endpoint=endpoint,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            total_tokens=prompt_tokens + completion_tokens,
            cost_estimate=_cost_estimate(model, prompt_tokens, completion_tokens),
            cached=cached,
        )
    )
    await db.commit()


def _cache_key(model: str, prompt: str, preferences: dict, include_backend: bool, include_db: bool) -> str:
    raw = json.dumps(
        {"m": model, "p": prompt, "t": preferences, "b": include_backend, "d": include_db}, sort_keys=True
    )
    return f"gen:{hashlib.sha256(raw.encode()).hexdigest()}"


async def stream_generate(
    db: AsyncSession,
    user: User,
    project: Project,
    prompt: str,
    include_backend: bool = True,
    include_db: bool = True,
    model: str | None = None,
) -> AsyncGenerator[str, None]:
    model = model or settings.llm_model
    project_history = (await _project_history(db, project.id)) or ""
    messages = build_generate_messages(
        prompt, project.tech_preferences, project.name, project_history, include_backend, include_db
    )
    truncated = truncate_messages(messages, settings.llm_context_window)

    # Mock mode / unconfigured LLM keeps the platform runnable.
    if settings.llm_mock or not settings.openrouter_api_key:
        yield {"type": "status", "message": "Using sample generator (mock mode). Set OPENROUTER_API_KEY for real AI."}
        result = get_sample_site(prompt)
        await record_usage(db, user, project, model, "generate", None)
        yield {"type": "result", "data": result}
        return

    cache_key = _cache_key(model, prompt, project.tech_preferences, include_backend, include_db)
    cached = await cache_get(cache_key)
    if cached:
        try:
            result = json.loads(cached)
            yield {"type": "status", "message": "Returning cached result."}
            await record_usage(db, user, project, model, "generate", None, cached=True)
            yield {"type": "result", "data": result}
            return
        except json.JSONDecodeError:
            pass

    yield {"type": "status", "message": f"Generating with {model}..."}
    full = ""
    usage = None
    try:
        async for chunk in _chat_stream(truncated, model=model):
            if chunk.startswith("__USAGE__:"):
                try:
                    usage = json.loads(chunk[len("__USAGE__:") :])
                except json.JSONDecodeError:
                    pass
                continue
            full += chunk
            yield {"type": "delta", "text": chunk}
    except LLMError as exc:
        yield {"type": "error", "message": str(exc)}
        return

    try:
        result = extract_json(full)
        if not isinstance(result.get("html"), str):
            raise LLMError("Result missing required 'html' field.")
    except LLMError as exc:
        yield {"type": "error", "message": str(exc)}
        return

    await record_usage(db, user, project, model, "generate", usage)
    await cache_set(cache_key, json.dumps(result), ttl=settings.llm_cache_ttl)
    yield {"type": "result", "data": result}


async def stream_refine(
    db: AsyncSession,
    user: User,
    project: Project,
    message: str,
    history: str,
    model: str | None = None,
) -> AsyncGenerator[str, None]:
    model = model or settings.llm_model
    current = await _current_version(db, project.id)
    messages = build_refine_messages(
        message,
        current["html"],
        current["css"],
        current["js"],
        current["backend"] or None,
        history,
    )
    truncated = truncate_messages(messages, settings.llm_context_window)

    if settings.llm_mock or not settings.openrouter_api_key:
        result = {
            "message": "Sample assistant (mock mode). Configure OPENROUTER_API_KEY for real AI suggestions.",
            "suggestion": None,
        }
        yield {"type": "delta", "text": result["message"]}
        await record_usage(db, user, project, model, "refine", None)
        yield {"type": "suggestion", "data": result}
        return

    full = ""
    usage = None
    try:
        async for chunk in _chat_stream(truncated, model=model):
            if chunk.startswith("__USAGE__:"):
                try:
                    usage = json.loads(chunk[len("__USAGE__:") :])
                except json.JSONDecodeError:
                    pass
                continue
            full += chunk
            yield {"type": "delta", "text": chunk}
    except LLMError as exc:
        yield {"type": "error", "message": str(exc)}
        return

    try:
        data = extract_json(full)
        result = {
            "message": data.get("message", "Here is my suggestion."),
            "suggestion": data.get("suggestion"),
        }
    except LLMError:
        result = {"message": full.strip(), "suggestion": None}

    await record_usage(db, user, project, model, "refine", usage)
    yield {"type": "suggestion", "data": result}


async def _current_version(db: AsyncSession, project_id) -> dict:
    from ..models import ProjectVersion

    result = await db.execute(
        select(ProjectVersion).where(ProjectVersion.project_id == project_id).order_by(ProjectVersion.version.desc())
    )
    version = result.scalars().first()
    if not version:
        return {"html": "", "css": "", "js": "", "backend": {}}
    return {"html": version.html or "", "css": version.css or "", "js": version.js or "", "backend": version.backend or {}}


async def _project_history(db: AsyncSession, project_id) -> str:
    from ..models import ChatMessage

    result = await db.execute(
        select(ChatMessage).where(ChatMessage.project_id == project_id).order_by(ChatMessage.created_at.asc()).limit(12)
    )
    messages = result.scalars().all()
    lines = []
    total_chars = 0
    for message in reversed(messages):
        chunk = f"{message.role}: {message.content[:400]}"
        if total_chars + len(chunk) > 6000:
            break
        lines.append(chunk)
        total_chars += len(chunk)
    return "\n".join(reversed(lines))


async def tokens_in_context(messages: list[dict]) -> int:
    return sum(estimate_tokens(m["content"]) for m in messages)

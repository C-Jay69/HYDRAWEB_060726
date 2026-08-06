"""LLM generation, vibe-coding chat, and suggestion application (all SSE)."""

import json
import uuid

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..deps import get_project_or_404, rate_limited_user
from ..llm.service import stream_generate, stream_refine
from ..models import ChatMessage, Project, User
from ..schemas.project import (
    ApplySuggestion,
    ChatMessageOut,
    ChatRequest,
    GenerateRequest,
    VersionDetail,
)
from ..services.versions import save_version

router = APIRouter(tags=["generate"])

SSE_HEADERS = {
    "Cache-Control": "no-cache",
    "X-Accel-Buffering": "no",
    "Connection": "keep-alive",
}


def _sse(data: dict) -> str:
    return f"data: {json.dumps(data)}\n\n"


@router.post("/projects/{project_id}/generate")
async def generate_site(
    project_id: uuid.UUID,
    body: GenerateRequest,
    user: User = Depends(rate_limited_user),
    db: AsyncSession = Depends(get_db),
):
    project = await get_project_or_404(db, project_id, user)
    project.status = "generating"
    await db.commit()

    async def event_stream():
        saved_version = False
        try:
            async for event in stream_generate(
                db, user, project, body.prompt, body.include_backend, body.include_db, body.model
            ):
                if event.get("type") == "result":
                    data = event["data"]
                    version = await save_version(
                        db,
                        project.id,
                        message=f"Generated: {data.get('summary', '')[:200]}"[:300],
                        html=data.get("html", ""),
                        css=data.get("css", ""),
                        js=data.get("js", ""),
                        backend=data.get("backend"),
                        db_schema=data.get("db_schema", ""),
                        diff={"type": "generate"},
                    )
                    db.add(
                        ChatMessage(
                            project_id=project.id,
                            user_id=user.id,
                            role="assistant",
                            content=data.get("summary", ""),
                            suggestion={"type": "generate"},
                        )
                    )
                    await db.commit()
                    saved_version = True
                    event = {"type": "result", "data": data, "version": version.version}
                yield _sse(event)
        except Exception as exc:  # pragma: no cover
            yield _sse({"type": "error", "message": f"Unexpected error: {exc}"})
        finally:
            if not saved_version:
                await db.execute(
                    update(Project).where(Project.id == project.id).values(status="draft")
                )
                await db.commit()

    return StreamingResponse(event_stream(), media_type="text/event-stream", headers=SSE_HEADERS)


@router.post("/projects/{project_id}/chat")
async def chat(
    project_id: uuid.UUID,
    body: ChatRequest,
    user: User = Depends(rate_limited_user),
    db: AsyncSession = Depends(get_db),
):
    project = await get_project_or_404(db, project_id, user)

    result = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.project_id == project.id)
        .order_by(ChatMessage.created_at.asc())
        .limit(20)
    )
    history_rows = result.scalars().all()
    history = "\n".join(f"{m.role}: {m.content[:300]}" for m in history_rows)

    db.add(ChatMessage(project_id=project.id, user_id=user.id, role="user", content=body.message))
    await db.commit()

    async def event_stream():
        try:
            suggestion_data = None
            async for event in stream_refine(db, user, project, body.message, history):
                if event.get("type") == "suggestion":
                    suggestion_data = event["data"]
                    assistant_msg = ChatMessage(
                        project_id=project.id,
                        user_id=user.id,
                        role="assistant",
                        content=suggestion_data.get("message", ""),
                        suggestion=suggestion_data.get("suggestion") or {},
                    )
                    db.add(assistant_msg)
                    await db.commit()
                yield _sse(event)
        except Exception as exc:  # pragma: no cover
            yield _sse({"type": "error", "message": f"Unexpected error: {exc}"})

    return StreamingResponse(event_stream(), media_type="text/event-stream", headers=SSE_HEADERS)


@router.post("/projects/{project_id}/apply", response_model=VersionDetail, status_code=201)
async def apply_suggestion(
    project_id: uuid.UUID,
    body: ApplySuggestion,
    user: User = Depends(rate_limited_user),
    db: AsyncSession = Depends(get_db),
):
    project = await get_project_or_404(db, project_id, user)

    # Load current version content so partial suggestions overlay cleanly.
    from ..models import ProjectVersion

    result = await db.execute(
        select(ProjectVersion)
        .where(ProjectVersion.project_id == project.id)
        .order_by(ProjectVersion.version.desc())
    )
    current = result.scalars().first()
    html = body.html if body.html is not None else (current.html if current else "")
    css = body.css if body.css is not None else (current.css if current else "")
    js = body.js if body.js is not None else (current.js if current else "")
    backend = body.backend if body.backend is not None else (current.backend if current else {})
    db_schema = body.db_schema if body.db_schema is not None else (current.db_schema if current else "")

    version = await save_version(
        db,
        project.id,
        message=body.message or "Applied AI suggestion",
        html=html,
        css=css,
        js=js,
        backend=backend,
        db_schema=db_schema,
        diff={"type": "apply"},
    )
    return version


@router.get("/projects/{project_id}/chat", response_model=list[ChatMessageOut])
async def list_chat(
    project_id: uuid.UUID,
    user: User = Depends(rate_limited_user),
    db: AsyncSession = Depends(get_db),
):
    project = await get_project_or_404(db, project_id, user)
    result = await db.execute(
        select(ChatMessage).where(ChatMessage.project_id == project.id).order_by(ChatMessage.created_at.asc())
    )
    return result.scalars().all()

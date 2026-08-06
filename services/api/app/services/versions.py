"""Version persistence helpers."""

import uuid

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import Project, ProjectVersion


async def save_version(
    db: AsyncSession,
    project_id: uuid.UUID,
    message: str,
    html: str = "",
    css: str = "",
    js: str = "",
    backend: dict | None = None,
    db_schema: str = "",
    files: dict | None = None,
    diff: dict | None = None,
) -> ProjectVersion:
    """Insert a new version and bump the project's latest_version atomically.

    Loads the project fresh inside the caller's session (with row lock) so it
    works even when the caller's ORM instance is detached (e.g. inside a
    streaming generator).
    """
    result = await db.execute(select(Project).where(Project.id == project_id).with_for_update())
    project = result.scalar_one()
    latest = project.latest_version + 1
    version = ProjectVersion(
        project_id=project_id,
        version=latest,
        message=message,
        html=html or "",
        css=css or "",
        js=js or "",
        backend=backend or {},
        db_schema=db_schema or "",
        files=files or {},
        diff=diff or {},
    )
    db.add(version)
    await db.execute(
        update(Project)
        .where(Project.id == project_id)
        .values(latest_version=latest, status="ready")
    )
    await db.commit()
    await db.refresh(version)
    return version

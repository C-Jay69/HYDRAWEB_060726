"""Project CRUD and version management."""

import uuid

from fastapi import APIRouter, Depends, HTTPException
from slugify import slugify
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import settings
from ..database import get_db
from ..deps import get_project_or_404, rate_limited_user, user_plan
from ..models import Project, ProjectVersion, User
from ..schemas.project import (
    ProjectCreate,
    ProjectOut,
    ProjectUpdate,
    VersionDetail,
    VersionOut,
)

router = APIRouter(tags=["projects"])


async def _unique_slug(db: AsyncSession, name: str) -> str:
    base = slugify(name) or "project"
    candidate = base
    i = 1
    while True:
        exists = await db.execute(select(Project).where(Project.slug == candidate))
        if exists.scalar_one_or_none() is None:
            return candidate
        candidate = f"{base}-{i}"
        i += 1


@router.get("/projects", response_model=list[ProjectOut])
async def list_projects(user: User = Depends(rate_limited_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Project).where(Project.user_id == user.id).order_by(Project.updated_at.desc())
    )
    return result.scalars().all()


@router.post("/projects", response_model=ProjectOut, status_code=201)
async def create_project(
    body: ProjectCreate,
    user: User = Depends(rate_limited_user),
    db: AsyncSession = Depends(get_db),
):
    plan = await user_plan(db, user)
    limit = settings.project_limit_for(plan)
    count = await db.scalar(select(func.count(Project.id)).where(Project.user_id == user.id))
    if count >= limit:
        raise HTTPException(
            status_code=402,
            detail=f"Your {plan} plan allows {limit} project(s). Upgrade to create more.",
        )
    slug = await _unique_slug(db, body.name)
    project = Project(
        user_id=user.id,
        name=body.name.strip(),
        description=body.description,
        visibility=body.visibility,
        slug=slug,
        prompt=body.prompt,
        tech_preferences=body.tech_preferences,
    )
    db.add(project)
    await db.commit()
    await db.refresh(project)
    return project


@router.get("/projects/{project_id}", response_model=ProjectOut)
async def get_project(
    project_id: uuid.UUID,
    user: User = Depends(rate_limited_user),
    db: AsyncSession = Depends(get_db),
):
    return await get_project_or_404(db, project_id, user)


@router.patch("/projects/{project_id}", response_model=ProjectOut)
async def update_project(
    project_id: uuid.UUID,
    body: ProjectUpdate,
    user: User = Depends(rate_limited_user),
    db: AsyncSession = Depends(get_db),
):
    project = await get_project_or_404(db, project_id, user)
    if body.name is not None:
        project.name = body.name.strip()
    if body.description is not None:
        project.description = body.description
    if body.visibility is not None:
        project.visibility = body.visibility
    if body.prompt is not None:
        project.prompt = body.prompt
    await db.commit()
    await db.refresh(project)
    return project


@router.delete("/projects/{project_id}", status_code=204)
async def delete_project(
    project_id: uuid.UUID,
    user: User = Depends(rate_limited_user),
    db: AsyncSession = Depends(get_db),
):
    project = await get_project_or_404(db, project_id, user)
    await db.delete(project)
    await db.commit()


@router.get("/projects/{project_id}/versions", response_model=list[VersionOut])
async def list_versions(
    project_id: uuid.UUID,
    user: User = Depends(rate_limited_user),
    db: AsyncSession = Depends(get_db),
):
    await get_project_or_404(db, project_id, user)
    result = await db.execute(
        select(ProjectVersion)
        .where(ProjectVersion.project_id == project_id)
        .order_by(ProjectVersion.version.desc())
    )
    return result.scalars().all()


@router.get("/projects/{project_id}/versions/{version}", response_model=VersionDetail)
async def get_version(
    project_id: uuid.UUID,
    version: int,
    user: User = Depends(rate_limited_user),
    db: AsyncSession = Depends(get_db),
):
    await get_project_or_404(db, project_id, user)
    result = await db.execute(
        select(ProjectVersion).where(
            ProjectVersion.project_id == project_id, ProjectVersion.version == version
        )
    )
    version_row = result.scalar_one_or_none()
    if version_row is None:
        raise HTTPException(status_code=404, detail="Version not found")
    return version_row


@router.post("/projects/{project_id}/versions/{version}/rollback", response_model=VersionDetail, status_code=201)
async def rollback_to_version(
    project_id: uuid.UUID,
    version: int,
    user: User = Depends(rate_limited_user),
    db: AsyncSession = Depends(get_db),
):
    project = await get_project_or_404(db, project_id, user)
    result = await db.execute(
        select(ProjectVersion).where(
            ProjectVersion.project_id == project_id, ProjectVersion.version == version
        )
    )
    target = result.scalar_one_or_none()
    if target is None:
        raise HTTPException(status_code=404, detail="Version not found")

    from ..models import ProjectVersion as PV
    from sqlalchemy import update

    latest = project.latest_version + 1
    new_version = PV(
        project_id=project.id,
        version=latest,
        message=f"Rollback to version {version}",
        html=target.html,
        css=target.css,
        js=target.js,
        backend=target.backend,
        db_schema=target.db_schema,
        files=target.files,
        diff={"from": version, "to": latest, "type": "rollback"},
    )
    db.add(new_version)
    await db.execute(
        update(Project).where(Project.id == project.id).values(latest_version=latest, status="ready")
    )
    await db.commit()
    await db.refresh(new_version)
    return new_version

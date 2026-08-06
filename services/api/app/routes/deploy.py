"""Deployments, static site hosting, and codebase export."""

import uuid

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..deps import get_project_or_404, rate_limited_user
from ..models import Deployment, User
from ..schemas.project import DeploymentOut, DeployRequest
from ..services.deploy_service import deploy, get_latest_version, read_site
from ..services.export_service import build_site_zip

router = APIRouter(tags=["deploy"])


@router.get("/projects/{project_id}/deployments", response_model=list[DeploymentOut])
async def list_deployments(
    project_id: uuid.UUID,
    user: User = Depends(rate_limited_user),
    db: AsyncSession = Depends(get_db),
):
    await get_project_or_404(db, project_id, user)
    result = await db.execute(
        select(Deployment).where(Deployment.project_id == project_id).order_by(Deployment.created_at.desc())
    )
    return result.scalars().all()


@router.post("/projects/{project_id}/deploy", response_model=DeploymentOut, status_code=201)
async def deploy_project(
    project_id: uuid.UUID,
    body: DeployRequest,
    user: User = Depends(rate_limited_user),
    db: AsyncSession = Depends(get_db),
):
    project = await get_project_or_404(db, project_id, user)
    version = await get_latest_version(db, project)
    if version is None or not version.html:
        raise HTTPException(status_code=400, detail="Generate the site before deploying.")
    try:
        deployment = await deploy(db, project, version, body.subdomain, body.env_vars)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return deployment


@router.get("/projects/{project_id}/export")
async def export_project(
    project_id: uuid.UUID,
    user: User = Depends(rate_limited_user),
    db: AsyncSession = Depends(get_db),
):
    project = await get_project_or_404(db, project_id, user)
    version = await get_latest_version(db, project)
    if version is None:
        raise HTTPException(status_code=404, detail="No generated version to export.")
    zip_bytes = build_site_zip(project, version)
    return Response(
        content=zip_bytes,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{project.slug}.zip"'},
    )


@router.get("/s/{subdomain}")
async def serve_site(subdomain: str):
    """Public static hosting for deployed subdomains."""
    try:
        html, mime = read_site(subdomain)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail="Site not found") from exc
    return Response(content=html, media_type=mime)

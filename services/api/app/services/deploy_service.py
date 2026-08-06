"""Deployment to platform-managed static hosting under custom subdomains.

Files are written to the local storage dir; in production point STORAGE_DIR at
an attached volume or mount S3-compatible storage. The wildcard DNS record
*.{PLATFORM_DOMAIN} routes subdomains to this service's /s/{subdomain} route.
"""

import logging
from pathlib import Path

from sqlalchemy.ext.asyncio import AsyncSession

from ..config import settings
from ..models import Deployment, Project, ProjectVersion

logger = logging.getLogger("hydraweb.deploy")

SUBDOMAIN_REGEX = r"^[a-z0-9]([a-z0-9-]{0,60}[a-z0-9])?$"


def sites_dir() -> Path:
    path = Path(settings.storage_dir) / "sites"
    path.mkdir(parents=True, exist_ok=True)
    return path


async def get_latest_version(db: AsyncSession, project: Project) -> ProjectVersion | None:
    from sqlalchemy import select

    result = await db.execute(
        select(ProjectVersion).where(ProjectVersion.project_id == project.id).order_by(ProjectVersion.version.desc())
    )
    return result.scalars().first()


async def deploy(db: AsyncSession, project: Project, version: ProjectVersion, subdomain: str, env_vars: dict) -> Deployment:
    import re

    if not re.match(SUBDOMAIN_REGEX, subdomain):
        raise ValueError("Invalid subdomain. Use lowercase letters, numbers and hyphens only.")
    if subdomain in {"api", "admin", "app", "www", "mail", "stripe", "s"}:
        raise ValueError("That subdomain is reserved.")

    site_root = sites_dir() / subdomain
    site_root.mkdir(parents=True, exist_ok=True)

    js = version.js or ""
    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{project.name}</title>
  <style>
{version.css or ""}
  </style>
</head>
<body>
{version.html or ""}
  <script>
{js}
  </script>
</body>
</html>"""
    (site_root / "index.html").write_text(html, encoding="utf-8")
    if version.backend:
        (site_root / "backend").mkdir(exist_ok=True)
        for filename, content in version.backend.items():
            safe = Path(filename).name
            (site_root / "backend" / safe).write_text(content, encoding="utf-8")
    if version.db_schema:
        (site_root / "schema.sql").write_text(version.db_schema, encoding="utf-8")

    if settings.environment == "production":
        target_url = f"https://{subdomain}.{settings.platform_domain}"
    else:
        target_url = f"{settings.api_url}/s/{subdomain}"

    deployment = Deployment(
        project_id=project.id,
        version=version.version,
        subdomain=subdomain,
        status="live",
        target_url=target_url,
        env_vars=env_vars,
    )
    db.add(deployment)
    await db.commit()
    await db.refresh(deployment)
    logger.info("Deployed %s -> %s", project.slug, subdomain)
    return deployment


def read_site(subdomain: str) -> tuple[str, str]:
    """Return (html, mime) for a deployed subdomain or raise FileNotFoundError."""
    index = sites_dir() / subdomain / "index.html"
    if not index.exists():
        raise FileNotFoundError(subdomain)
    return index.read_text(encoding="utf-8"), "text/html; charset=utf-8"

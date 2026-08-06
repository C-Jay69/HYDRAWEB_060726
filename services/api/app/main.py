"""HydraWeb API — FastAPI application entrypoint."""

import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .config import settings
from .llm.service import LLMError
from .routes import admin, auth, billing, deploy, generate, projects, teams, users

logging.basicConfig(
    level=logging.INFO,
    format='{"ts":"%(asctime)s","level":"%(levelname)s","logger":"%(name)s","msg":"%(message)s"}',
)
logger = logging.getLogger("hydraweb")


@asynccontextmanager
async def lifespan(_: FastAPI):
    sites = Path(settings.storage_dir) / "sites"
    sites.mkdir(parents=True, exist_ok=True)
    logger.info("HydraWeb API starting in %s mode", settings.environment)
    if settings.llm_mock or not settings.openrouter_api_key:
        logger.warning("LLM provider not configured — generation will use mock samples.")
    if not settings.stripe_secret_key:
        logger.warning("Stripe not configured — billing endpoints will return 503.")
    yield


app = FastAPI(
    title="HydraWeb API",
    version="1.0.0",
    description="AI-powered website generation and vibe-coding SaaS backend. Docs at /docs (Swagger) and /redoc.",
    lifespan=lifespan,
    openapi_tags=[
        {"name": "auth", "description": "Signup, login, verification, OAuth"},
        {"name": "users", "description": "Profile, API keys, subscription"},
        {"name": "projects", "description": "Projects and versions"},
        {"name": "generate", "description": "LLM generation and vibe-coding chat (SSE)"},
        {"name": "deploy", "description": "Deployments, hosting, export"},
        {"name": "billing", "description": "Stripe plans, checkout, webhooks"},
        {"name": "teams", "description": "Team workspaces"},
        {"name": "admin", "description": "Analytics and moderation"},
    ],
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(projects.router)
app.include_router(generate.router)
app.include_router(deploy.router)
app.include_router(billing.router)
app.include_router(teams.router)
app.include_router(admin.router)


@app.exception_handler(LLMError)
async def llm_error_handler(_: Request, exc: LLMError):
    return JSONResponse(status_code=502, content={"detail": str(exc)})


@app.get("/", include_in_schema=False)
async def root():
    return {"service": settings.app_name, "docs": "/docs", "health": "/health"}


@app.get("/health", tags=["health"])
async def health():
    return {"status": "ok", "environment": settings.environment}

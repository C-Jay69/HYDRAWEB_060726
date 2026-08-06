"""Authentication: signup, login, verification, password reset, OAuth."""

import httpx
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import RedirectResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import settings
from ..database import get_db
from ..deps import rate_limited_user
from ..models import Subscription, User
from ..schemas.auth import (
    LoginRequest,
    PasswordResetConfirm,
    PasswordResetRequest,
    SignupRequest,
    TokenResponse,
    UserPublic,
    VerifyResponse,
)
from ..security import create_access_token, decode_token, hash_password, verify_password
from ..services.email import send_mail
from ..services.stripe_service import ensure_customer, get_or_create_subscription

router = APIRouter(prefix="/auth", tags=["auth"])


def _user_public(user: User, plan: str) -> UserPublic:
    return UserPublic(
        id=user.id,
        email=user.email,
        name=user.name,
        avatar_url=user.avatar_url,
        bio=user.bio,
        social_links=user.social_links or {},
        role=user.role,
        is_verified=user.is_verified,
        created_at=user.created_at,
        last_login=user.last_login,
        plan=plan,
    )


async def _plan_for(db: AsyncSession, user: User) -> str:
    result = await db.execute(select(Subscription).where(Subscription.user_id == user.id))
    sub = result.scalar_one_or_none()
    if sub and sub.plan_tier in ("pro", "enterprise") and sub.status == "active":
        return sub.plan_tier
    return "free"


async def _token_response(db: AsyncSession, user: User) -> TokenResponse:
    plan = await _plan_for(db, user)
    token = create_access_token(str(user.id), user.email, user.role, plan)
    return TokenResponse(access_token=token, user=_user_public(user, plan))


def _make_admin_if_configured(user: User) -> None:
    if user.email.lower() in settings.admin_email_list:
        user.role = "admin"


@router.post("/signup", response_model=TokenResponse, status_code=201)
async def signup(body: SignupRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == body.email.lower()))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="An account with this email already exists.")

    user = User(
        email=body.email.lower(),
        name=body.name.strip(),
        password_hash=hash_password(body.password),
    )
    _make_admin_if_configured(user)
    if settings.auto_verify_email or not settings.smtp_host:
        user.is_verified = True
    db.add(user)
    await db.flush()

    sub = Subscription(user_id=user.id, plan_tier="free", status="active")
    db.add(sub)
    await db.flush()

    # Best-effort Stripe customer creation.
    if settings.stripe_secret_key:
        try:
            await ensure_customer(db, user)
        except Exception:
            pass

    if not user.is_verified:
        token = create_access_token(str(user.id), user.email, user.role, "free", extra={"type": "verify"})
        link = f"{settings.frontend_url}/verify?token={token}"
        send_mail(user.email, "Verify your HydraWeb account", f"Click to verify: {link}")
        await db.commit()
        raise HTTPException(status_code=202, detail="Verification email sent.")

    await db.commit()
    await db.refresh(user)
    return await _token_response(db, user)


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == body.email.lower()))
    user = result.scalar_one_or_none()
    if user is None or not user.password_hash or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if user.is_banned:
        raise HTTPException(status_code=403, detail="This account has been suspended.")
    from datetime import datetime, timezone

    user.last_login = datetime.now(timezone.utc)
    await db.commit()
    return await _token_response(db, user)


@router.get("/verify/{token}", response_model=VerifyResponse)
async def verify_email(token: str, db: AsyncSession = Depends(get_db)):
    try:
        payload = decode_token(token)
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Invalid or expired verification token") from exc
    if payload.get("type") != "verify":
        raise HTTPException(status_code=400, detail="Invalid token type")
    from uuid import UUID

    user = await db.get(User, UUID(payload["sub"]))
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_verified = True
    await db.commit()
    return VerifyResponse(detail="Email verified")


@router.post("/reset-password", response_model=VerifyResponse)
async def request_password_reset(body: PasswordResetRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == body.email.lower()))
    user = result.scalar_one_or_none()
    if user is None or not user.password_hash:
        # Do not leak account existence.
        return VerifyResponse(detail="If that email exists, a reset link has been sent.")
    token = create_access_token(str(user.id), user.email, user.role, "free", extra={"type": "reset"})
    link = f"{settings.frontend_url}/reset-password?token={token}"
    send_mail(user.email, "Reset your HydraWeb password", f"Click to reset: {link}")
    return VerifyResponse(detail="If that email exists, a reset link has been sent.")


@router.post("/reset-password/confirm", response_model=VerifyResponse)
async def confirm_password_reset(body: PasswordResetConfirm, db: AsyncSession = Depends(get_db)):
    try:
        payload = decode_token(body.token)
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Invalid or expired token") from exc
    if payload.get("type") != "reset":
        raise HTTPException(status_code=400, detail="Invalid token type")
    from uuid import UUID

    user = await db.get(User, UUID(payload["sub"]))
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    user.password_hash = hash_password(body.new_password)
    await db.commit()
    return VerifyResponse(detail="Password updated")


@router.get("/me", response_model=UserPublic)
async def me(user: User = Depends(rate_limited_user), db: AsyncSession = Depends(get_db)):
    plan = await _plan_for(db, user)
    return _user_public(user, plan)


@router.get("/oauth/{provider}")
async def oauth_start(provider: str):
    config = _provider_config(provider)
    authorize_url, params = config["authorize"](config)
    from urllib.parse import urlencode

    redirect = f"{authorize_url}?{urlencode(params)}"
    return RedirectResponse(redirect)


@router.get("/oauth/{provider}/callback")
async def oauth_callback(provider: str, code: str, db: AsyncSession = Depends(get_db)):
    config = _provider_config(provider)
    token = await config["exchange"](config, code)
    profile = await config["profile"](token)
    return await _handle_oauth_user(db, provider, profile)


def _provider_config(provider: str) -> dict:
    if provider == "github":
        if not settings.github_client_id or not settings.github_client_secret:
            raise HTTPException(status_code=501, detail="GitHub OAuth is not configured")
        return {
            "name": "github",
            "client_id": settings.github_client_id,
            "client_secret": settings.github_client_secret,
            "redirect_uri": f"{settings.api_url}/auth/oauth/github/callback",
            "authorize": lambda c: (
                "https://github.com/login/oauth/authorize",
                {"client_id": c["client_id"], "redirect_uri": c["redirect_uri"], "scope": "user:email"},
            ),
            "exchange": _exchange_github,
            "profile": _profile_github,
        }
    if provider == "google":
        if not settings.google_client_id or not settings.google_client_secret:
            raise HTTPException(status_code=501, detail="Google OAuth is not configured")
        return {
            "name": "google",
            "client_id": settings.google_client_id,
            "client_secret": settings.google_client_secret,
            "redirect_uri": f"{settings.api_url}/auth/oauth/google/callback",
            "authorize": lambda c: (
                "https://accounts.google.com/o/oauth2/v2/auth",
                {
                    "client_id": c["client_id"],
                    "redirect_uri": c["redirect_uri"],
                    "response_type": "code",
                    "scope": "openid email profile",
                },
            ),
            "exchange": _exchange_google,
            "profile": _profile_google,
        }
    raise HTTPException(status_code=400, detail=f"Unsupported OAuth provider: {provider}")


async def _exchange_github(config: dict, code: str) -> str:
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            "https://github.com/login/oauth/access_token",
            json={
                "client_id": config["client_id"],
                "client_secret": config["client_secret"],
                "code": code,
                "redirect_uri": config["redirect_uri"],
            },
            headers={"Accept": "application/json"},
        )
        data = resp.json()
    token = data.get("access_token")
    if not token:
        raise HTTPException(status_code=401, detail="OAuth exchange failed")
    return token


async def _exchange_google(config: dict, code: str) -> str:
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            "https://oauth2.googleapis.com/token",
            data={
                "client_id": config["client_id"],
                "client_secret": config["client_secret"],
                "code": code,
                "grant_type": "authorization_code",
                "redirect_uri": config["redirect_uri"],
            },
        )
        data = resp.json()
    token = data.get("access_token")
    if not token:
        raise HTTPException(status_code=401, detail="OAuth exchange failed")
    return token


async def _profile_github(token: str) -> dict:
    async with httpx.AsyncClient(timeout=30) as client:
        headers = {"Authorization": f"Bearer {token}"}
        user = (await client.get("https://api.github.com/user", headers=headers)).json()
        emails = (await client.get("https://api.github.com/user/emails", headers=headers)).json()
        primary = next((e for e in emails if e.get("primary")), emails[0] if emails else {})
        return {
            "email": user.get("email") or primary.get("email") or "",
            "name": user.get("name") or user.get("login") or "",
            "avatar_url": user.get("avatar_url"),
            "provider_id": str(user.get("id")),
        }


async def _profile_google(token: str) -> dict:
    async with httpx.AsyncClient(timeout=30) as client:
        info = (
            await client.get(
                "https://www.googleapis.com/oauth2/v2/userinfo",
                headers={"Authorization": f"Bearer {token}"},
            )
        ).json()
    return {
        "email": info.get("email", ""),
        "name": info.get("name", ""),
        "avatar_url": info.get("picture"),
        "provider_id": info.get("id"),
    }


async def _handle_oauth_user(db: AsyncSession, provider: str, profile: dict):
    email = (profile.get("email") or "").lower()
    if not email:
        raise HTTPException(status_code=400, detail="OAuth provider did not return an email")

    result = await db.execute(
        select(User).where(
            (User.email == email) | ((User.oauth_provider == provider) & (User.oauth_provider_id == profile.get("provider_id")))
        )
    )
    user = result.scalars().first()

    if user is None:
        user = User(
            email=email,
            name=profile.get("name", ""),
            avatar_url=profile.get("avatar_url"),
            oauth_provider=provider,
            oauth_provider_id=str(profile.get("provider_id") or ""),
            is_verified=True,
        )
        _make_admin_if_configured(user)
        db.add(user)
        await db.flush()
        db.add(Subscription(user_id=user.id, plan_tier="free", status="active"))
        await db.flush()
        if settings.stripe_secret_key:
            try:
                await ensure_customer(db, user)
            except Exception:
                pass
    elif not user.oauth_provider_id:
        user.oauth_provider = provider
        user.oauth_provider_id = str(profile.get("provider_id") or "")
        if profile.get("avatar_url"):
            user.avatar_url = profile["avatar_url"]
        user.is_verified = True

    from datetime import datetime, timezone

    user.last_login = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(user)
    resp = await _token_response(db, user)
    return RedirectResponse(f"{settings.frontend_url}/oauth-callback?token={resp.access_token}")

"""Stripe subscriptions, one-time payments, portal, and webhook sync."""

import logging
from datetime import UTC, datetime

import stripe
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import settings
from ..models import OneTimePayment, Subscription, User

logger = logging.getLogger("hydraweb.stripe")

stripe.api_key = settings.stripe_secret_key

PLAN_INFO = {
    "free": {"name": "Free", "project_limit": settings.free_project_limit, "features": ["1 project", "100 req/min"]},
    "pro": {"name": "Pro", "project_limit": settings.pro_project_limit, "features": ["10 projects", "300 req/min", "Priority model access"]},
    "enterprise": {"name": "Enterprise", "project_limit": settings.enterprise_project_limit, "features": ["Unlimited projects", "1000 req/min", "Priority support"]},
}

_PRICE_IDS = {
    "pro": {"monthly": settings.stripe_price_pro_monthly, "annual": settings.stripe_price_pro_annual},
    "enterprise": {"monthly": settings.stripe_price_enterprise_monthly, "annual": settings.stripe_price_enterprise_annual},
}

PLAN_FROM_PRICE: dict[str, tuple[str, str]] = {
    settings.stripe_price_pro_monthly: ("pro", "monthly"),
    settings.stripe_price_pro_annual: ("pro", "annual"),
    settings.stripe_price_enterprise_monthly: ("enterprise", "monthly"),
    settings.stripe_price_enterprise_annual: ("enterprise", "annual"),
}

PRICE_LABELS = {
    settings.stripe_price_pro_monthly: ("pro", "$20/mo"),
    settings.stripe_price_pro_annual: ("pro", "$192/yr"),
    settings.stripe_price_enterprise_monthly: ("enterprise", "$100/mo"),
    settings.stripe_price_enterprise_annual: ("enterprise", "$960/yr"),
}


def configure() -> None:
    stripe.api_key = settings.stripe_secret_key


async def ensure_customer(db: AsyncSession, user: User) -> str:
    if user.stripe_customer_id:
        return user.stripe_customer_id
    customer = stripe.Customer.create(email=user.email, name=user.name, metadata={"user_id": str(user.id)})
    user.stripe_customer_id = customer.id
    await db.commit()
    return customer.id


async def create_checkout_session(db: AsyncSession, user: User, tier: str, cycle: str) -> str:
    price_id = _PRICE_IDS[tier][cycle]
    customer = await ensure_customer(db, user)
    session = stripe.checkout.Session.create(
        mode="subscription",
        customer=customer,
        line_items=[{"price": price_id, "quantity": 1}],
        success_url=f"{settings.frontend_url}/billing?success=1",
        cancel_url=f"{settings.frontend_url}/billing?canceled=1",
        client_reference_id=str(user.id),
        metadata={"user_id": str(user.id), "tier": tier, "cycle": cycle, "plan": tier},
    )
    return session.url


async def create_billing_portal(db: AsyncSession, user: User) -> str:
    customer = await ensure_customer(db, user)
    session = stripe.billing_portal.Session.create(
        customer=customer,
        return_url=f"{settings.frontend_url}/billing",
    )
    return session.url


def construct_event(payload: bytes, sig_header: str) -> stripe.Event:
    return stripe.Webhook.construct_event(payload, sig_header, settings.stripe_webhook_secret)


async def get_or_create_subscription(db: AsyncSession, user: User) -> Subscription:
    result = await db.execute(select(Subscription).where(Subscription.user_id == user.id))
    sub = result.scalar_one_or_none()
    if sub is None:
        sub = Subscription(user_id=user.id, plan_tier="free", status="active")
        db.add(sub)
        await db.commit()
        await db.refresh(sub)
    return sub


async def set_plan(db: AsyncSession, user: User, tier: str, cycle: str, stripe_subscription_id: str | None = None) -> Subscription:
    sub = await get_or_create_subscription(db, user)
    sub.plan_tier = tier
    sub.billing_cycle = cycle
    if stripe_subscription_id:
        sub.stripe_subscription_id = stripe_subscription_id
    sub.status = "active"
    await db.commit()
    await db.refresh(sub)
    return sub


async def downgrade_to_free(db: AsyncSession, user: User) -> Subscription:
    sub = await get_or_create_subscription(db, user)
    sub.plan_tier = "free"
    sub.status = "active"
    sub.stripe_subscription_id = None
    sub.current_period_end = None
    await db.commit()
    await db.refresh(sub)
    return sub


async def record_one_time_payment(
    db: AsyncSession,
    user: User | None,
    payment_intent_id: str,
    amount: int,
    currency: str,
    product_name: str,
    metadata: dict,
) -> None:
    db.add(
        OneTimePayment(
            user_id=user.id if user else None,
            stripe_payment_intent_id=payment_intent_id,
            amount=amount,
            currency=currency,
            product_name=product_name,
            metadata_=metadata,
        )
    )
    await db.commit()


def current_period_end_from(sub: stripe.Subscription) -> datetime | None:
    item = sub.get("items") or {}
    data = item.get("data") or []
    period = None
    if data and data[0].get("current_period_end"):
        period = data[0]["current_period_end"]
    elif sub.get("current_period_end"):
        period = sub["current_period_end"]
    return datetime.fromtimestamp(period, tz=UTC) if period else None

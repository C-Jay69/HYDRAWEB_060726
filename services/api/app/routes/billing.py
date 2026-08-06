"""Stripe billing: plans, checkout, portal, one-time payments, webhooks, invoices."""

import logging
from datetime import UTC

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import settings
from ..database import get_db
from ..deps import rate_limited_user
from ..models import User
from ..schemas.billing import (
    BillingPortalResponse,
    CheckoutRequest,
    CheckoutResponse,
    PlanOut,
    SubscriptionOut,
)
from ..services import stripe_service

router = APIRouter(prefix="/billing", tags=["billing"])
logger = logging.getLogger("hydraweb.billing")


def _plan_rows() -> list[PlanOut]:
    rows = []
    for tier, meta in stripe_service.PLAN_INFO.items():
        price_ids = stripe_service._PRICE_IDS.get(tier, {})
        rows.append(
            PlanOut(
                tier=tier,
                name=meta["name"],
                price_monthly=stripe_service.PRICE_LABELS.get(price_ids.get("monthly"), ("", "$0/mo"))[1],
                price_annual=stripe_service.PRICE_LABELS.get(price_ids.get("annual"), ("", "$0/mo"))[1],
                project_limit=meta["project_limit"],
                rate_limit=settings.rate_limit_for(tier),
                features=meta["features"],
            )
        )
    return rows


@router.get("/plans", response_model=list[PlanOut])
async def plans():
    return _plan_rows()


@router.post("/checkout", response_model=CheckoutResponse)
async def checkout(
    body: CheckoutRequest,
    user: User = Depends(rate_limited_user),
    db: AsyncSession = Depends(get_db),
):
    if not settings.stripe_secret_key:
        raise HTTPException(status_code=503, detail="Billing is not configured yet.")
    try:
        url = await stripe_service.create_checkout_session(db, user, body.tier, body.cycle)
    except Exception as exc:  # stripe.errors.StripeError
        logger.exception("Checkout failed")
        raise HTTPException(status_code=502, detail=f"Stripe error: {exc}") from exc
    return CheckoutResponse(url=url)


@router.post("/portal", response_model=BillingPortalResponse)
async def billing_portal(
    user: User = Depends(rate_limited_user),
    db: AsyncSession = Depends(get_db),
):
    if not settings.stripe_secret_key:
        raise HTTPException(status_code=503, detail="Billing is not configured yet.")
    url = await stripe_service.create_billing_portal(db, user)
    return BillingPortalResponse(url=url)


@router.get("/subscription", response_model=SubscriptionOut)
async def subscription(
    user: User = Depends(rate_limited_user),
    db: AsyncSession = Depends(get_db),
):
    sub = await stripe_service.get_or_create_subscription(db, user)
    return sub


@router.get("/invoices")
async def invoices(
    user: User = Depends(rate_limited_user),
    db: AsyncSession = Depends(get_db),
):
    if not settings.stripe_secret_key:
        raise HTTPException(status_code=503, detail="Billing is not configured yet.")
    if not user.stripe_customer_id:
        return []
    import stripe

    stripe.api_key = settings.stripe_secret_key
    data = stripe.Invoice.list(customer=user.stripe_customer_id, limit=20)
    return [
        {
            "id": inv.get("id"),
            "amount_due": inv.get("amount_due", 0),
            "currency": inv.get("currency", "usd"),
            "status": inv.get("status"),
            "created": inv.get("created"),
            "url": inv.get("invoice_pdf"),
            "period": inv.get("period"),
        }
        for inv in data.get("data", [])
    ]


@router.post("/one-time")
async def create_one_time_payment(
    body: dict,
    user: User = Depends(rate_limited_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a one-time payment (e.g. premium custom generation)."""
    if not settings.stripe_secret_key:
        raise HTTPException(status_code=503, detail="Billing is not configured yet.")
    import stripe

    stripe.api_key = settings.stripe_secret_key
    customer = await stripe_service.ensure_customer(db, user)
    amount = int(body.get("amount", 5000))
    product_name = str(body.get("product_name", "Premium AI generation"))
    intent = stripe.PaymentIntent.create(
        amount=amount,
        currency="usd",
        customer=customer,
        metadata={"user_id": str(user.id), "product_name": product_name},
        automatic_payment_methods={"enabled": True},
    )
    return {"client_secret": intent.client_secret, "payment_intent_id": intent.id, "amount": amount}


@router.post("/webhook")
async def stripe_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    if not settings.stripe_webhook_secret:
        raise HTTPException(status_code=503, detail="Webhook secret not configured.")
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature", "")
    try:
        event = stripe_service.construct_event(payload, sig_header)
    except Exception as exc:
        logger.warning("Webhook signature verification failed: %s", exc)
        raise HTTPException(status_code=400, detail="Invalid signature") from exc

    await _handle_event(db, event)
    return {"received": True}


async def _handle_event(db: AsyncSession, event) -> None:
    event_type = event.get("type")
    data = event.get("data", {}).get("object", {})

    if event_type == "checkout.session.completed":
        metadata = data.get("metadata") or {}
        user_id = metadata.get("user_id") or data.get("client_reference_id")
        if user_id:
            from uuid import UUID

            user = await db.get(User, UUID(user_id))
            if user:
                if data.get("customer"):
                    user.stripe_customer_id = data["customer"]
                tier = metadata.get("tier", "pro")
                cycle = metadata.get("cycle", "monthly")
                sub = await stripe_service.set_plan(
                    db, user, tier, cycle, data.get("subscription")
                )
                sub.status = "active"
                await db.commit()

    elif event_type in ("customer.subscription.created", "customer.subscription.updated"):
        await _sync_subscription(db, data)

    elif event_type == "customer.subscription.deleted":
        await _sync_subscription(db, data)

    elif event_type == "invoice.paid":
        customer_id = data.get("customer")
        subscription_id = data.get("subscription")
        if customer_id and subscription_id:
            user = await _find_user_by_customer(db, customer_id)
            if user:
                sub = await stripe_service.get_or_create_subscription(db, user)
                sub.status = "active"
                if data.get("period_start") or data.get("period_end"):
                    from datetime import datetime

                    period_end = data.get("period_end")
                    if period_end:
                        sub.current_period_end = datetime.fromtimestamp(period_end, tz=UTC)
                await db.commit()

    elif event_type == "payment_intent.succeeded":
        metadata = data.get("metadata") or {}
        user_id = metadata.get("user_id")
        user = None
        if user_id:
            from uuid import UUID

            try:
                user = await db.get(User, UUID(user_id))
            except ValueError:
                user = None
        await stripe_service.record_one_time_payment(
            db,
            user,
            data.get("id", ""),
            int(data.get("amount", 0)),
            data.get("currency", "usd"),
            metadata.get("product_name", "One-time payment"),
            metadata,
        )

    logger.info("Handled Stripe event: %s", event_type)


async def _sync_subscription(db: AsyncSession, sub_data: dict) -> None:
    sub_id = sub_data.get("id")
    customer_id = sub_data.get("customer")
    status = sub_data.get("status")
    items = (sub_data.get("items") or {}).get("data") or []
    price_id = items[0].get("price", {}).get("id") if items else None
    tier, cycle = stripe_service.PLAN_FROM_PRICE.get(price_id, ("free", "monthly"))

    user = await _find_user_by_customer(db, customer_id)
    if user is None:
        return
    sub = await stripe_service.get_or_create_subscription(db, user)
    sub.stripe_subscription_id = sub_id
    sub.status = status or "active"
    sub.plan_tier = tier
    sub.billing_cycle = cycle
    period = stripe_service.current_period_end_from(sub_data)
    if period:
        sub.current_period_end = period
    if status in ("canceled", "unpaid", "past_due") and tier == "free":
        sub.plan_tier = "free"
    await db.commit()


async def _find_user_by_customer(db: AsyncSession, customer_id: str | None) -> User | None:
    if not customer_id:
        return None
    result = await db.execute(select(User).where(User.stripe_customer_id == customer_id))
    return result.scalar_one_or_none()

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class PlanOut(BaseModel):
    tier: str
    name: str
    price_monthly: str
    price_annual: str
    project_limit: int
    rate_limit: int
    features: list[str]


class CheckoutRequest(BaseModel):
    tier: str = Field(pattern="^(pro|enterprise)$")
    cycle: str = Field(default="monthly", pattern="^(monthly|annual)$")


class CheckoutResponse(BaseModel):
    url: str


class SubscriptionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    plan_tier: str
    status: str
    billing_cycle: str
    current_period_end: datetime | None = None
    created_at: datetime
    updated_at: datetime


class ApiKeyCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)


class ApiKeyOut(BaseModel):
    id: uuid.UUID
    name: str
    prefix: str
    enabled: bool
    created_at: datetime
    last_used_at: datetime | None = None


class ApiKeyCreated(BaseModel):
    id: uuid.UUID
    name: str
    key: str
    prefix: str
    note: str = "Store this key now — it will not be shown again."


class BillingPortalResponse(BaseModel):
    url: str

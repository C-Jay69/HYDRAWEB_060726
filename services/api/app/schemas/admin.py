from pydantic import BaseModel


class AdminStats(BaseModel):
    users: int
    projects: int
    deployments: int
    api_keys: int
    teams: int
    llm_calls: int
    llm_total_tokens: int
    revenue_cents: int
    one_time_revenue_cents: int
    signups_last_7_days: int
    projects_last_7_days: int

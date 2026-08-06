"""Stripe billing endpoint tests (no live Stripe key in CI)."""


async def test_plans_endpoint(client):
    resp = await client.get("/billing/plans")
    assert resp.status_code == 200
    tiers = [p["tier"] for p in resp.json()]
    assert tiers == ["free", "pro", "enterprise"]


async def test_checkout_requires_configuration(client, auth_headers):
    resp = await client.post(
        "/billing/checkout", json={"tier": "pro", "cycle": "monthly"}, headers=auth_headers
    )
    # No STRIPE_SECRET_KEY configured in tests -> 503.
    assert resp.status_code == 503


async def test_subscription_defaults_to_free(client, auth_headers):
    resp = await client.get("/billing/subscription", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["plan_tier"] == "free"


async def test_webhook_requires_secret(client):
    resp = await client.post("/billing/webhook", json={})
    assert resp.status_code == 503


async def test_api_key_creation_and_usage(client, auth_headers):
    created = await client.post("/users/me/api-keys", json={"name": "ci"}, headers=auth_headers)
    assert created.status_code == 201
    key = created.json()["key"]
    assert key.startswith("hw_")

    listed = await client.get("/users/me/api-keys", headers=auth_headers)
    assert len(listed.json()) == 1

    me_with_key = await client.get("/auth/me", headers={"X-API-Key": key})
    assert me_with_key.status_code == 200
    assert me_with_key.json()["email"] == "alice@example.com"

    deleted = await client.delete(
        f"/users/me/api-keys/{created.json()['id']}", headers=auth_headers
    )
    assert deleted.status_code == 204

    revoked = await client.get("/auth/me", headers={"X-API-Key": key})
    assert revoked.status_code == 401


async def test_teams_flow(client, auth_headers):
    team = await client.post("/teams", json={"name": "Agency"}, headers=auth_headers)
    assert team.status_code == 201
    team_id = team.json()["id"]
    assert team.json()["members"][0]["role"] == "owner"

    invite = await client.post(
        f"/teams/{team_id}/invite",
        json={"email": "carol@example.com", "role": "editor"},
        headers=auth_headers,
    )
    assert invite.status_code == 404  # carol doesn't exist yet

    await client.post(
        "/auth/signup",
        json={"email": "carol@example.com", "password": "password123", "name": "Carol"},
    )
    invite = await client.post(
        f"/teams/{team_id}/invite",
        json={"email": "carol@example.com", "role": "editor"},
        headers=auth_headers,
    )
    assert invite.status_code == 201
    assert any(m["email"] == "carol@example.com" and m["role"] == "editor" for m in invite.json()["members"])

    teams = await client.get("/teams", headers=auth_headers)
    assert len(teams.json()) == 1

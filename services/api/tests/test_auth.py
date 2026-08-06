"""Auth endpoint tests."""


async def test_signup_and_login_flow(client):
    resp = await client.post(
        "/auth/signup", json={"email": "bob@example.com", "password": "password123", "name": "Bob"}
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["access_token"]
    assert data["user"]["email"] == "bob@example.com"
    assert data["user"]["plan"] == "free"

    login = await client.post(
        "/auth/login", json={"email": "bob@example.com", "password": "password123"}
    )
    assert login.status_code == 200
    assert login.json()["access_token"]


async def test_duplicate_signup_rejected(client):
    await client.post(
        "/auth/signup", json={"email": "dup@example.com", "password": "password123", "name": "Dup"}
    )
    resp = await client.post(
        "/auth/signup", json={"email": "dup@example.com", "password": "password123", "name": "Dup"}
    )
    assert resp.status_code == 409


async def test_invalid_login_rejected(client):
    resp = await client.post(
        "/auth/login", json={"email": "nobody@example.com", "password": "password123"}
    )
    assert resp.status_code == 401


async def test_me_requires_auth(client):
    resp = await client.get("/auth/me")
    assert resp.status_code == 401


async def test_me_returns_profile(client, auth_headers):
    resp = await client.get("/auth/me", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["email"] == "alice@example.com"


async def test_password_reset_flow(client):
    await client.post(
        "/auth/signup", json={"email": "reset@example.com", "password": "password123", "name": "Reset"}
    )
    resp = await client.post("/auth/reset-password", json={"email": "reset@example.com"})
    assert resp.status_code == 200
    # Unknown email does not leak existence.
    resp2 = await client.post("/auth/reset-password", json={"email": "missing@example.com"})
    assert resp2.status_code == 200
    assert resp2.json()["detail"] == resp.json()["detail"]

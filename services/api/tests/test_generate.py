"""LLM generation and vibe-coding tests (streaming response parsing + mocked LLM)."""

import json

import pytest


async def _create_project(client, headers):
    resp = await client.post(
        "/projects",
        json={"name": "AI Site", "prompt": "A portfolio site"},
        headers=headers,
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


FAKE_RESULT = {
    "summary": "A portfolio site",
    "html": "<section><h1>Hi</h1></section>",
    "css": "h1{color:red}",
    "js": "console.log('ok')",
    "backend": {"main.py": "from fastapi import FastAPI\napp=FastAPI()\n@app.get('/')\ndef root(): return {'ok': True}"},
    "db_schema": "CREATE TABLE posts (id serial primary key);",
}


async def _fake_stream_generate(db, user, project, prompt, include_backend=True, include_db=True, model=None):
    yield {"type": "status", "message": "start"}
    yield {"type": "delta", "text": "work"}
    yield {"type": "result", "data": FAKE_RESULT}


async def _fake_stream_refine(db, user, project, message, history, model=None):
    yield {"type": "delta", "text": "You could add a contact form."}
    yield {"type": "suggestion", "data": {"message": "Here is my suggestion.", "suggestion": {"css": "form{display:grid}"}}}


def _parse_sse(text: str) -> list[dict]:
    events = []
    for line in text.splitlines():
        if line.startswith("data: "):
            events.append(json.loads(line[6:]))
    return events


@pytest.fixture
def mock_llm(monkeypatch):
    import app.routes.generate as route_module

    monkeypatch.setattr(route_module, "stream_generate", _fake_stream_generate)
    monkeypatch.setattr(route_module, "stream_refine", _fake_stream_refine)


async def test_generate_creates_version_and_chat(client, auth_headers, mock_llm):
    project_id = await _create_project(client, auth_headers)
    resp = await client.post(
        f"/projects/{project_id}/generate",
        json={"prompt": "A portfolio site", "include_backend": True, "include_db": True},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    events = _parse_sse(resp.text)
    result_events = [e for e in events if e["type"] == "result"]
    assert len(result_events) == 1
    assert result_events[0]["data"]["html"] == FAKE_RESULT["html"]
    assert result_events[0]["version"] == 1

    # Chat history should include the assistant summary.
    chat = await client.get(f"/projects/{project_id}/chat", headers=auth_headers)
    assert chat.status_code == 200
    assert any(m["role"] == "assistant" for m in chat.json())


async def test_chat_returns_suggestion(client, auth_headers, mock_llm):
    project_id = await _create_project(client, auth_headers)
    resp = await client.post(
        f"/projects/{project_id}/chat",
        json={"message": "add a contact form"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    events = _parse_sse(resp.text)
    suggestion = [e for e in events if e["type"] == "suggestion"]
    assert suggestion
    assert suggestion[0]["data"]["suggestion"]["css"] == "form{display:grid}"


async def test_apply_suggestion_overlays_current(client, auth_headers, mock_llm):
    project_id = await _create_project(client, auth_headers)
    await client.post(
        f"/projects/{project_id}/generate",
        json={"prompt": "A portfolio site"},
        headers=auth_headers,
    )
    applied = await client.post(
        f"/projects/{project_id}/apply",
        json={"css": "form{display:grid}", "message": "Add contact form styles"},
        headers=auth_headers,
    )
    assert applied.status_code == 201
    assert applied.json()["version"] == 2
    assert applied.json()["css"] == "form{display:grid}"
    assert applied.json()["html"] == FAKE_RESULT["html"]


async def test_deploy_and_export(client, auth_headers, mock_llm):
    project_id = await _create_project(client, auth_headers)
    await client.post(
        f"/projects/{project_id}/generate",
        json={"prompt": "A portfolio site"},
        headers=auth_headers,
    )
    deployed = await client.post(
        f"/projects/{project_id}/deploy",
        json={"subdomain": "alice-site", "env_vars": {"STRIPE_SECRET_KEY": "sk_test_123"}},
        headers=auth_headers,
    )
    assert deployed.status_code == 201, deployed.text
    assert deployed.json()["status"] == "live"
    assert deployed.json()["subdomain"] == "alice-site"

    # Static site is served publicly.
    site = await client.get("/s/alice-site")
    assert site.status_code == 200
    assert "Hi" in site.text

    exported = await client.get(f"/projects/{project_id}/export", headers=auth_headers)
    assert exported.status_code == 200
    assert exported.headers["content-type"] == "application/zip"
    assert len(exported.content) > 100


async def test_deploy_rejects_reserved_subdomain(client, auth_headers, mock_llm):
    project_id = await _create_project(client, auth_headers)
    await client.post(
        f"/projects/{project_id}/generate",
        json={"prompt": "A portfolio site"},
        headers=auth_headers,
    )
    resp = await client.post(
        f"/projects/{project_id}/deploy",
        json={"subdomain": "admin"},
        headers=auth_headers,
    )
    assert resp.status_code == 400

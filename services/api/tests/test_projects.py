"""Project and version management tests."""


async def _create_project(client, headers, name="Job Board", prompt="A job board with auth"):
    return await client.post(
        "/projects",
        json={"name": name, "prompt": prompt, "visibility": "private"},
        headers=headers,
    )


async def test_create_and_list_projects(client, auth_headers):
    created = await _create_project(client, auth_headers)
    assert created.status_code == 201, created.text
    assert created.json()["slug"] == "job-board"

    listed = await client.get("/projects", headers=auth_headers)
    assert listed.status_code == 200
    assert len(listed.json()) == 1


async def test_project_visibility_to_other_users(client, auth_headers):
    created = await _create_project(client, auth_headers)
    project_id = created.json()["id"]

    await client.post(
        "/auth/signup", json={"email": "carol@example.com", "password": "password123", "name": "Carol"}
    )
    other_headers = {"Authorization": f"Bearer {(await client.post('/auth/login', json={'email': 'carol@example.com', 'password': 'password123'})).json()['access_token']}"}

    resp = await client.get(f"/projects/{project_id}", headers=other_headers)
    assert resp.status_code == 403


async def test_update_and_delete_project(client, auth_headers):
    created = await _create_project(client, auth_headers)
    project_id = created.json()["id"]

    updated = await client.patch(
        f"/projects/{project_id}", json={"name": "Renamed"}, headers=auth_headers
    )
    assert updated.status_code == 200
    assert updated.json()["name"] == "Renamed"

    deleted = await client.delete(f"/projects/{project_id}", headers=auth_headers)
    assert deleted.status_code == 204

    gone = await client.get(f"/projects/{project_id}", headers=auth_headers)
    assert gone.status_code == 404


async def test_free_plan_project_limit_enforced(client, auth_headers):
    first = await _create_project(client, auth_headers, name="One")
    assert first.status_code == 201
    second = await _create_project(client, auth_headers, name="Two")
    assert second.status_code == 402
    assert "Upgrade" in second.json()["detail"]


async def test_version_rollback(client, auth_headers):
    created = await _create_project(client, auth_headers)
    project_id = created.json()["id"]

    applied = await client.post(
        f"/projects/{project_id}/apply",
        json={"html": "<h1>new</h1>", "css": "h1{color:red}", "message": "Apply"},
        headers=auth_headers,
    )
    assert applied.status_code == 201
    assert applied.json()["version"] == 1

    versions = await client.get(f"/projects/{project_id}/versions", headers=auth_headers)
    assert versions.status_code == 200
    assert len(versions.json()) == 1

    detail = await client.get(f"/projects/{project_id}/versions/1", headers=auth_headers)
    assert detail.status_code == 200
    assert detail.json()["html"] == "<h1>new</h1>"

    rolled = await client.post(
        f"/projects/{project_id}/versions/1/rollback", headers=auth_headers
    )
    assert rolled.status_code == 201
    assert rolled.json()["version"] == 2
    assert rolled.json()["html"] == "<h1>new</h1>"

    after = await client.get(f"/projects/{project_id}/versions/2", headers=auth_headers)
    assert after.status_code == 200
    assert "Rollback" in after.json()["message"]

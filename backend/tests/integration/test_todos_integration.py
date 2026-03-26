"""
Integration tests for /api/v1/todos endpoints.

Requires a running Supabase instance. Automatically skipped if unavailable.
All created todos are cleaned up automatically via the test_user session fixture
(which deletes the user and all associated rows via ON DELETE CASCADE).
"""
import pytest

from tests.integration.conftest import skip_if_no_supabase

pytestmark = skip_if_no_supabase


@pytest.fixture
def created_todo(integration_client, test_user):
    """Create a todo and yield its data. Deleted after the test."""
    resp = integration_client.post(
        "/api/v1/todos",
        json={"title": "Fixture todo", "description": "Created by fixture"},
        headers=test_user["auth_headers"],
    )
    assert resp.status_code == 201
    todo = resp.json()
    yield todo
    # Best-effort cleanup (user deletion in teardown also covers this)
    integration_client.delete(
        f"/api/v1/todos/{todo['id']}",
        headers=test_user["auth_headers"],
    )


class TestCreateTodoIntegration:
    def test_create_todo_with_title_and_description(self, integration_client, test_user):
        resp = integration_client.post(
            "/api/v1/todos",
            json={"title": "Buy groceries", "description": "Milk, eggs, bread"},
            headers=test_user["auth_headers"],
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["title"] == "Buy groceries"
        assert data["description"] == "Milk, eggs, bread"
        assert data["is_completed"] is False
        assert data["user_id"] == test_user["user_id"]
        assert "id" in data
        assert "created_at" in data
        assert "updated_at" in data
        # Cleanup
        integration_client.delete(f"/api/v1/todos/{data['id']}", headers=test_user["auth_headers"])

    def test_create_todo_default_description(self, integration_client, test_user):
        resp = integration_client.post(
            "/api/v1/todos",
            json={"title": "No description todo"},
            headers=test_user["auth_headers"],
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["description"] == ""
        integration_client.delete(f"/api/v1/todos/{data['id']}", headers=test_user["auth_headers"])

    def test_create_todo_missing_title(self, integration_client, test_user):
        resp = integration_client.post(
            "/api/v1/todos",
            json={"description": "No title"},
            headers=test_user["auth_headers"],
        )
        assert resp.status_code == 422

    def test_create_todo_requires_auth(self, integration_client):
        resp = integration_client.post(
            "/api/v1/todos",
            json={"title": "Unauthorized"},
        )
        assert resp.status_code == 422


class TestListTodosIntegration:
    def test_list_todos_returns_list(self, integration_client, test_user, created_todo):
        resp = integration_client.get("/api/v1/todos", headers=test_user["auth_headers"])
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        ids = [t["id"] for t in data]
        assert created_todo["id"] in ids

    def test_list_todos_only_own(self, integration_client, test_user, created_todo):
        """Todos returned must all belong to the authenticated user (RLS check)."""
        resp = integration_client.get("/api/v1/todos", headers=test_user["auth_headers"])
        assert resp.status_code == 200
        for todo in resp.json():
            assert todo["user_id"] == test_user["user_id"]

    def test_list_todos_ordered_by_created_at_desc(self, integration_client, test_user):
        """Most recently created todo should come first."""
        ids = []
        for i in range(3):
            r = integration_client.post(
                "/api/v1/todos",
                json={"title": f"Ordered todo {i}"},
                headers=test_user["auth_headers"],
            )
            assert r.status_code == 201
            ids.append(r.json()["id"])

        resp = integration_client.get("/api/v1/todos", headers=test_user["auth_headers"])
        assert resp.status_code == 200
        returned_ids = [t["id"] for t in resp.json()]
        # Last created should appear first
        assert returned_ids.index(ids[2]) < returned_ids.index(ids[0])

        for todo_id in ids:
            integration_client.delete(f"/api/v1/todos/{todo_id}", headers=test_user["auth_headers"])


class TestGetTodoIntegration:
    def test_get_todo_by_id(self, integration_client, test_user, created_todo):
        resp = integration_client.get(
            f"/api/v1/todos/{created_todo['id']}",
            headers=test_user["auth_headers"],
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["id"] == created_todo["id"]
        assert data["title"] == created_todo["title"]

    def test_get_todo_not_found(self, integration_client, test_user):
        resp = integration_client.get(
            "/api/v1/todos/00000000-0000-0000-0000-000000000000",
            headers=test_user["auth_headers"],
        )
        assert resp.status_code == 404

    def test_get_todo_requires_auth(self, integration_client, created_todo):
        resp = integration_client.get(f"/api/v1/todos/{created_todo['id']}")
        assert resp.status_code == 422


class TestUpdateTodoIntegration:
    def test_update_title(self, integration_client, test_user, created_todo):
        resp = integration_client.patch(
            f"/api/v1/todos/{created_todo['id']}",
            json={"title": "Updated title"},
            headers=test_user["auth_headers"],
        )
        assert resp.status_code == 200
        assert resp.json()["title"] == "Updated title"

    def test_update_mark_completed(self, integration_client, test_user, created_todo):
        resp = integration_client.patch(
            f"/api/v1/todos/{created_todo['id']}",
            json={"is_completed": True},
            headers=test_user["auth_headers"],
        )
        assert resp.status_code == 200
        assert resp.json()["is_completed"] is True

    def test_update_multiple_fields(self, integration_client, test_user, created_todo):
        resp = integration_client.patch(
            f"/api/v1/todos/{created_todo['id']}",
            json={"title": "New title", "description": "New desc", "is_completed": True},
            headers=test_user["auth_headers"],
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["title"] == "New title"
        assert data["description"] == "New desc"
        assert data["is_completed"] is True

    def test_update_empty_body_returns_400(self, integration_client, test_user, created_todo):
        resp = integration_client.patch(
            f"/api/v1/todos/{created_todo['id']}",
            json={},
            headers=test_user["auth_headers"],
        )
        assert resp.status_code == 400
        assert resp.json()["detail"] == "No fields to update"

    def test_update_nonexistent_todo(self, integration_client, test_user):
        resp = integration_client.patch(
            "/api/v1/todos/00000000-0000-0000-0000-000000000000",
            json={"title": "Ghost update"},
            headers=test_user["auth_headers"],
        )
        assert resp.status_code == 404

    def test_update_updates_updated_at(self, integration_client, test_user, created_todo):
        original_updated_at = created_todo["updated_at"]
        import time; time.sleep(1)  # ensure timestamp differs
        resp = integration_client.patch(
            f"/api/v1/todos/{created_todo['id']}",
            json={"title": "Timestamp check"},
            headers=test_user["auth_headers"],
        )
        assert resp.status_code == 200
        assert resp.json()["updated_at"] != original_updated_at


class TestDeleteTodoIntegration:
    def test_delete_todo(self, integration_client, test_user):
        create_resp = integration_client.post(
            "/api/v1/todos",
            json={"title": "To be deleted"},
            headers=test_user["auth_headers"],
        )
        assert create_resp.status_code == 201
        todo_id = create_resp.json()["id"]

        del_resp = integration_client.delete(
            f"/api/v1/todos/{todo_id}",
            headers=test_user["auth_headers"],
        )
        assert del_resp.status_code == 204

        # Verify it's gone
        get_resp = integration_client.get(
            f"/api/v1/todos/{todo_id}",
            headers=test_user["auth_headers"],
        )
        assert get_resp.status_code == 404

    def test_delete_nonexistent_todo(self, integration_client, test_user):
        resp = integration_client.delete(
            "/api/v1/todos/00000000-0000-0000-0000-000000000000",
            headers=test_user["auth_headers"],
        )
        assert resp.status_code == 404

    def test_delete_requires_auth(self, integration_client, created_todo):
        resp = integration_client.delete(f"/api/v1/todos/{created_todo['id']}")
        assert resp.status_code == 422

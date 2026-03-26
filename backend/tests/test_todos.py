from unittest.mock import MagicMock, patch
from datetime import datetime, timezone

from tests.conftest import AUTH_HEADERS

TODO_ROW = {
    "id": "todo-1",
    "user_id": "user-123",
    "title": "Buy milk",
    "description": "From the store",
    "image_path": None,
    "is_completed": False,
    "created_at": "2024-01-01T00:00:00+00:00",
    "updated_at": "2024-01-01T00:00:00+00:00",
}


def _make_mock_user_sb():
    return MagicMock()


class TestListTodos:
    def test_list_todos_success(self, client):
        mock_sb = _make_mock_user_sb()
        mock_sb.table.return_value.select.return_value.order.return_value.execute.return_value.data = [TODO_ROW]

        with patch("app.api.v1.todos.get_user_supabase", return_value=mock_sb):
            resp = client.get("/api/v1/todos", headers=AUTH_HEADERS)

        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert data[0]["title"] == "Buy milk"

    def test_list_todos_empty(self, client):
        mock_sb = _make_mock_user_sb()
        mock_sb.table.return_value.select.return_value.order.return_value.execute.return_value.data = []

        with patch("app.api.v1.todos.get_user_supabase", return_value=mock_sb):
            resp = client.get("/api/v1/todos", headers=AUTH_HEADERS)

        assert resp.status_code == 200
        assert resp.json() == []

    def test_list_todos_unauthorized(self):
        from app.main import app
        from fastapi.testclient import TestClient

        plain_client = TestClient(app)
        resp = plain_client.get("/api/v1/todos")
        assert resp.status_code == 422  # missing Authorization header


class TestCreateTodo:
    def test_create_todo_success(self, client):
        mock_sb = _make_mock_user_sb()
        mock_sb.table.return_value.insert.return_value.execute.return_value.data = [TODO_ROW]

        with patch("app.api.v1.todos.get_user_supabase", return_value=mock_sb):
            resp = client.post(
                "/api/v1/todos",
                json={"title": "Buy milk", "description": "From the store"},
                headers=AUTH_HEADERS,
            )

        assert resp.status_code == 201
        assert resp.json()["title"] == "Buy milk"

    def test_create_todo_missing_title(self, client):
        resp = client.post(
            "/api/v1/todos",
            json={"description": "No title"},
            headers=AUTH_HEADERS,
        )
        assert resp.status_code == 422

    def test_create_todo_default_description(self, client):
        mock_sb = _make_mock_user_sb()
        row = {**TODO_ROW, "description": ""}
        mock_sb.table.return_value.insert.return_value.execute.return_value.data = [row]

        with patch("app.api.v1.todos.get_user_supabase", return_value=mock_sb):
            resp = client.post(
                "/api/v1/todos",
                json={"title": "No desc"},
                headers=AUTH_HEADERS,
            )

        assert resp.status_code == 201
        assert resp.json()["description"] == ""


class TestGetTodo:
    def test_get_todo_success(self, client):
        mock_sb = _make_mock_user_sb()
        mock_sb.table.return_value.select.return_value.eq.return_value.execute.return_value.data = [TODO_ROW]

        with patch("app.api.v1.todos.get_user_supabase", return_value=mock_sb):
            resp = client.get("/api/v1/todos/todo-1", headers=AUTH_HEADERS)

        assert resp.status_code == 200
        assert resp.json()["id"] == "todo-1"

    def test_get_todo_not_found(self, client):
        mock_sb = _make_mock_user_sb()
        mock_sb.table.return_value.select.return_value.eq.return_value.execute.return_value.data = []

        with patch("app.api.v1.todos.get_user_supabase", return_value=mock_sb):
            resp = client.get("/api/v1/todos/nonexistent", headers=AUTH_HEADERS)

        assert resp.status_code == 404
        assert resp.json()["detail"] == "Todo not found"


class TestUpdateTodo:
    def test_update_todo_success(self, client):
        updated_row = {**TODO_ROW, "title": "Buy oat milk", "is_completed": True}
        mock_sb = _make_mock_user_sb()
        mock_sb.table.return_value.update.return_value.eq.return_value.execute.return_value.data = [updated_row]

        with patch("app.api.v1.todos.get_user_supabase", return_value=mock_sb):
            resp = client.patch(
                "/api/v1/todos/todo-1",
                json={"title": "Buy oat milk", "is_completed": True},
                headers=AUTH_HEADERS,
            )

        assert resp.status_code == 200
        assert resp.json()["title"] == "Buy oat milk"

    def test_update_todo_not_found(self, client):
        mock_sb = _make_mock_user_sb()
        mock_sb.table.return_value.update.return_value.eq.return_value.execute.return_value.data = []

        with patch("app.api.v1.todos.get_user_supabase", return_value=mock_sb):
            resp = client.patch(
                "/api/v1/todos/nonexistent",
                json={"title": "Updated"},
                headers=AUTH_HEADERS,
            )

        assert resp.status_code == 404

    def test_update_todo_no_fields(self, client):
        with patch("app.api.v1.todos.get_user_supabase", return_value=_make_mock_user_sb()):
            resp = client.patch("/api/v1/todos/todo-1", json={}, headers=AUTH_HEADERS)

        assert resp.status_code == 400
        assert resp.json()["detail"] == "No fields to update"

    def test_update_todo_partial(self, client):
        updated_row = {**TODO_ROW, "is_completed": True}
        mock_sb = _make_mock_user_sb()
        mock_sb.table.return_value.update.return_value.eq.return_value.execute.return_value.data = [updated_row]

        with patch("app.api.v1.todos.get_user_supabase", return_value=mock_sb):
            resp = client.patch(
                "/api/v1/todos/todo-1",
                json={"is_completed": True},
                headers=AUTH_HEADERS,
            )

        assert resp.status_code == 200
        assert resp.json()["is_completed"] is True


class TestDeleteTodo:
    def test_delete_todo_success(self, client):
        mock_sb = _make_mock_user_sb()
        mock_sb.table.return_value.delete.return_value.eq.return_value.execute.return_value.data = [TODO_ROW]

        with patch("app.api.v1.todos.get_user_supabase", return_value=mock_sb):
            resp = client.delete("/api/v1/todos/todo-1", headers=AUTH_HEADERS)

        assert resp.status_code == 204

    def test_delete_todo_not_found(self, client):
        mock_sb = _make_mock_user_sb()
        mock_sb.table.return_value.delete.return_value.eq.return_value.execute.return_value.data = []

        with patch("app.api.v1.todos.get_user_supabase", return_value=mock_sb):
            resp = client.delete("/api/v1/todos/nonexistent", headers=AUTH_HEADERS)

        assert resp.status_code == 404

"""
Unit tests for /api/v1/users/me endpoints.

Supabase is fully mocked — no live instance required.
The `client` fixture (from conftest.py) overrides `get_current_user` with MOCK_USER.
Each test patches `app.api.v1.users.get_user_supabase` to control DB responses.
"""
from unittest.mock import MagicMock, patch

from tests.conftest import AUTH_HEADERS

USER_ROW = {
    "id": "user-123",
    "phone": "+919876543210",
    "full_name": "Test User",
    "avatar_url": None,
    "push_token": None,
    "is_merchant": False,
    "created_at": "2024-01-01T00:00:00+00:00",
}


def _make_mock_sb():
    return MagicMock()


class TestGetUser:
    def test_get_user_success(self, client):
        mock_sb = _make_mock_sb()
        mock_sb.table.return_value.select.return_value.eq.return_value.execute.return_value.data = [
            USER_ROW
        ]

        with patch("app.api.v1.users.get_user_supabase", return_value=mock_sb):
            resp = client.get("/api/v1/users/me", headers=AUTH_HEADERS)

        assert resp.status_code == 200
        data = resp.json()
        assert data["id"] == "user-123"
        assert data["phone"] == "+919876543210"
        assert data["full_name"] == "Test User"

    def test_get_user_not_found(self, client):
        mock_sb = _make_mock_sb()
        mock_sb.table.return_value.select.return_value.eq.return_value.execute.return_value.data = []

        with patch("app.api.v1.users.get_user_supabase", return_value=mock_sb):
            resp = client.get("/api/v1/users/me", headers=AUTH_HEADERS)

        assert resp.status_code == 404
        assert resp.json()["detail"] == "Profile not found"

    def test_get_user_no_auth(self):
        """Missing Authorization header → FastAPI validation returns 422."""
        from app.main import app
        from fastapi.testclient import TestClient

        plain_client = TestClient(app)
        resp = plain_client.get("/api/v1/users/me")
        assert resp.status_code == 422


class TestUpdateUser:
    def test_update_user_full_name(self, client):
        updated_row = {**USER_ROW, "full_name": "New Name"}
        mock_sb = _make_mock_sb()
        mock_sb.table.return_value.update.return_value.eq.return_value.execute.return_value.data = [
            updated_row
        ]

        with patch("app.api.v1.users.get_user_supabase", return_value=mock_sb):
            resp = client.patch(
                "/api/v1/users/me",
                json={"full_name": "New Name"},
                headers=AUTH_HEADERS,
            )

        assert resp.status_code == 200
        assert resp.json()["full_name"] == "New Name"

    def test_update_user_avatar_url(self, client):
        updated_row = {**USER_ROW, "avatar_url": "https://example.com/avatar.png"}
        mock_sb = _make_mock_sb()
        mock_sb.table.return_value.update.return_value.eq.return_value.execute.return_value.data = [
            updated_row
        ]

        with patch("app.api.v1.users.get_user_supabase", return_value=mock_sb):
            resp = client.patch(
                "/api/v1/users/me",
                json={"avatar_url": "https://example.com/avatar.png"},
                headers=AUTH_HEADERS,
            )

        assert resp.status_code == 200
        assert resp.json()["avatar_url"] == "https://example.com/avatar.png"

    def test_update_user_both_fields(self, client):
        updated_row = {
            **USER_ROW,
            "full_name": "Full Name",
            "avatar_url": "https://example.com/pic.jpg",
        }
        mock_sb = _make_mock_sb()
        mock_sb.table.return_value.update.return_value.eq.return_value.execute.return_value.data = [
            updated_row
        ]

        with patch("app.api.v1.users.get_user_supabase", return_value=mock_sb):
            resp = client.patch(
                "/api/v1/users/me",
                json={
                    "full_name": "Full Name",
                    "avatar_url": "https://example.com/pic.jpg",
                },
                headers=AUTH_HEADERS,
            )

        assert resp.status_code == 200
        data = resp.json()
        assert data["full_name"] == "Full Name"
        assert data["avatar_url"] == "https://example.com/pic.jpg"

    def test_update_user_empty_body(self, client):
        """PATCH with no fields set → 400 with 'No fields to update'."""
        with patch("app.api.v1.users.get_user_supabase", return_value=_make_mock_sb()):
            resp = client.patch("/api/v1/users/me", json={}, headers=AUTH_HEADERS)

        assert resp.status_code == 400
        assert resp.json()["detail"] == "No fields to update"

    def test_update_user_no_auth(self):
        """Missing Authorization header → FastAPI validation returns 422."""
        from app.main import app
        from fastapi.testclient import TestClient

        plain_client = TestClient(app)
        resp = plain_client.patch("/api/v1/users/me", json={"full_name": "Ghost"})
        assert resp.status_code == 422

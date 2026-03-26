"""
Unit tests for /api/v1/profile endpoints.

Supabase is fully mocked — no live instance required.
The `client` fixture (from conftest.py) overrides `get_current_user` with MOCK_USER.
Each test patches `app.api.v1.profile.get_user_supabase` to control DB responses.
"""
from unittest.mock import MagicMock, patch

from tests.conftest import AUTH_HEADERS

PROFILE_ROW = {
    "id": "user-123",
    "email": "test@example.com",
    "full_name": "Test User",
    "avatar_url": None,
    "push_token": None,
    "created_at": "2024-01-01T00:00:00+00:00",
    "updated_at": "2024-01-01T00:00:00+00:00",
}


def _make_mock_sb():
    return MagicMock()


class TestGetProfile:
    def test_get_profile_success(self, client):
        mock_sb = _make_mock_sb()
        mock_sb.table.return_value.select.return_value.eq.return_value.execute.return_value.data = [
            PROFILE_ROW
        ]

        with patch("app.api.v1.profile.get_user_supabase", return_value=mock_sb):
            resp = client.get("/api/v1/profile", headers=AUTH_HEADERS)

        assert resp.status_code == 200
        data = resp.json()
        assert data["id"] == "user-123"
        assert data["email"] == "test@example.com"
        assert data["full_name"] == "Test User"

    def test_get_profile_not_found(self, client):
        mock_sb = _make_mock_sb()
        mock_sb.table.return_value.select.return_value.eq.return_value.execute.return_value.data = []

        with patch("app.api.v1.profile.get_user_supabase", return_value=mock_sb):
            resp = client.get("/api/v1/profile", headers=AUTH_HEADERS)

        assert resp.status_code == 404
        assert resp.json()["detail"] == "Profile not found"

    def test_get_profile_no_auth(self):
        """Missing Authorization header → FastAPI validation returns 422."""
        from app.main import app
        from fastapi.testclient import TestClient

        plain_client = TestClient(app)
        resp = plain_client.get("/api/v1/profile")
        assert resp.status_code == 422


class TestUpdateProfile:
    def test_update_profile_full_name(self, client):
        updated_row = {**PROFILE_ROW, "full_name": "New Name"}
        mock_sb = _make_mock_sb()
        mock_sb.table.return_value.update.return_value.eq.return_value.execute.return_value.data = [
            updated_row
        ]

        with patch("app.api.v1.profile.get_user_supabase", return_value=mock_sb):
            resp = client.patch(
                "/api/v1/profile",
                json={"full_name": "New Name"},
                headers=AUTH_HEADERS,
            )

        assert resp.status_code == 200
        assert resp.json()["full_name"] == "New Name"

    def test_update_profile_avatar_url(self, client):
        updated_row = {**PROFILE_ROW, "avatar_url": "https://example.com/avatar.png"}
        mock_sb = _make_mock_sb()
        mock_sb.table.return_value.update.return_value.eq.return_value.execute.return_value.data = [
            updated_row
        ]

        with patch("app.api.v1.profile.get_user_supabase", return_value=mock_sb):
            resp = client.patch(
                "/api/v1/profile",
                json={"avatar_url": "https://example.com/avatar.png"},
                headers=AUTH_HEADERS,
            )

        assert resp.status_code == 200
        assert resp.json()["avatar_url"] == "https://example.com/avatar.png"

    def test_update_profile_both_fields(self, client):
        updated_row = {
            **PROFILE_ROW,
            "full_name": "Full Name",
            "avatar_url": "https://example.com/pic.jpg",
        }
        mock_sb = _make_mock_sb()
        mock_sb.table.return_value.update.return_value.eq.return_value.execute.return_value.data = [
            updated_row
        ]

        with patch("app.api.v1.profile.get_user_supabase", return_value=mock_sb):
            resp = client.patch(
                "/api/v1/profile",
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

    def test_update_profile_empty_body(self, client):
        """PATCH with no fields set → 400 with 'No fields to update'."""
        with patch("app.api.v1.profile.get_user_supabase", return_value=_make_mock_sb()):
            resp = client.patch("/api/v1/profile", json={}, headers=AUTH_HEADERS)

        assert resp.status_code == 400
        assert resp.json()["detail"] == "No fields to update"

    def test_update_profile_no_auth(self):
        """Missing Authorization header → FastAPI validation returns 422."""
        from app.main import app
        from fastapi.testclient import TestClient

        plain_client = TestClient(app)
        resp = plain_client.patch("/api/v1/profile", json={"full_name": "Ghost"})
        assert resp.status_code == 422

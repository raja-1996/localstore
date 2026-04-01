"""
Unit tests for PUT /api/v1/users/me/push-token (Sprint 9).

Supabase is fully mocked — no live instance required.
The `client` fixture (from conftest.py) overrides `get_current_user` with MOCK_USER.
Each test patches `app.api.v1.users.get_user_supabase` to control DB responses.
"""
from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient

from app.main import app
from tests.conftest import AUTH_HEADERS

PATCH_TARGET = "app.api.v1.users.get_user_supabase"

VALID_PUSH_TOKEN = "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]"

PROFILE_ROW = {
    "id": "user-123",
    "phone": "+919876543210",
    "full_name": "Test User",
    "avatar_url": None,
    "push_token": VALID_PUSH_TOKEN,
    "is_merchant": False,
    "created_at": "2024-01-01T00:00:00+00:00",
}


def _make_mock_sb():
    return MagicMock()


def _make_update_mock(rows):
    """UPDATE...eq() chain returning rows."""
    mock = MagicMock()
    execute_result = MagicMock()
    execute_result.data = rows
    mock.table.return_value.update.return_value.eq.return_value.execute.return_value = execute_result
    return mock


class TestPushToken:
    def test_register_push_token_success(self, client):
        """PUT /users/me/push-token — UPDATE OK; 200, {"registered": true}."""
        mock_sb = _make_mock_sb()
        mock_sb.table.return_value.update.return_value.eq.return_value.execute.return_value.data = [
            PROFILE_ROW
        ]

        with patch(PATCH_TARGET, return_value=mock_sb):
            resp = client.put(
                "/api/v1/users/me/push-token",
                json={"token": VALID_PUSH_TOKEN},
                headers=AUTH_HEADERS,
            )

        assert resp.status_code == 200
        assert resp.json() == {"registered": True}

    def test_register_push_token_empty_token(self, client):
        """PUT /users/me/push-token — token=''; 422 (Pydantic min_length=1)."""
        resp = client.put(
            "/api/v1/users/me/push-token",
            json={"token": ""},
            headers=AUTH_HEADERS,
        )
        assert resp.status_code == 422

    def test_register_push_token_missing_token(self, client):
        """PUT /users/me/push-token — body {}; 422 (required field missing)."""
        resp = client.put(
            "/api/v1/users/me/push-token",
            json={},
            headers=AUTH_HEADERS,
        )
        assert resp.status_code == 422

    def test_register_push_token_no_auth(self):
        """PUT /users/me/push-token — no auth headers; 422."""
        plain_client = TestClient(app)
        resp = plain_client.put(
            "/api/v1/users/me/push-token",
            json={"token": VALID_PUSH_TOKEN},
        )
        assert resp.status_code == 422

    def test_register_push_token_profile_not_found(self, client):
        """PUT /users/me/push-token — UPDATE returns []; 404."""
        mock_sb = _make_mock_sb()
        mock_sb.table.return_value.update.return_value.eq.return_value.execute.return_value.data = []

        with patch(PATCH_TARGET, return_value=mock_sb):
            resp = client.put(
                "/api/v1/users/me/push-token",
                json={"token": VALID_PUSH_TOKEN},
                headers=AUTH_HEADERS,
            )

        assert resp.status_code == 404
        assert resp.json()["detail"] == "Profile not found"

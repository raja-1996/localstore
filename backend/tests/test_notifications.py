import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi.testclient import TestClient

from app.main import app
from tests.conftest import AUTH_HEADERS

VALID_EXPO_TOKEN = "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]"
VALID_BARE_TOKEN = "abcdefghijklmnopqrstu"  # 21 chars, matches [a-zA-Z0-9_\-]{20,}


def _make_mock_user_sb(data=None):
    mock_sb = MagicMock()
    result = MagicMock()
    result.data = data if data is not None else [{"id": "user-123", "push_token": VALID_EXPO_TOKEN}]
    mock_sb.table.return_value.update.return_value.eq.return_value.execute.return_value = result
    return mock_sb


def _make_mock_admin_sb(push_token=VALID_EXPO_TOKEN):
    mock_sb = MagicMock()
    result = MagicMock()
    result.data = [{"push_token": push_token}] if push_token else []
    mock_sb.table.return_value.select.return_value.eq.return_value.execute.return_value = result
    return mock_sb


class TestRegisterToken:
    def test_success_expo_token(self, client):
        mock_sb = _make_mock_user_sb()

        with patch("app.api.v1.notifications.get_user_supabase", return_value=mock_sb):
            resp = client.post(
                "/api/v1/notifications/register-token",
                json={"token": VALID_EXPO_TOKEN},
                headers=AUTH_HEADERS,
            )

        assert resp.status_code == 200
        assert resp.json()["message"] == "Token registered successfully"

    def test_success_bare_token(self, client):
        mock_sb = _make_mock_user_sb()

        with patch("app.api.v1.notifications.get_user_supabase", return_value=mock_sb):
            resp = client.post(
                "/api/v1/notifications/register-token",
                json={"token": VALID_BARE_TOKEN},
                headers=AUTH_HEADERS,
            )

        assert resp.status_code == 200
        assert resp.json()["message"] == "Token registered successfully"

    def test_invalid_token_format(self, client):
        with patch("app.api.v1.notifications.get_user_supabase"):
            resp = client.post(
                "/api/v1/notifications/register-token",
                json={"token": "not-a-valid-token!"},
                headers=AUTH_HEADERS,
            )

        assert resp.status_code == 422

    def test_empty_token(self, client):
        with patch("app.api.v1.notifications.get_user_supabase"):
            resp = client.post(
                "/api/v1/notifications/register-token",
                json={"token": "   "},
                headers=AUTH_HEADERS,
            )

        assert resp.status_code == 422

    def test_missing_auth_header(self):
        # Use a raw client without the get_current_user override so the
        # auth dependency runs and rejects the missing header with 422.
        raw_client = TestClient(app)
        resp = raw_client.post(
            "/api/v1/notifications/register-token",
            json={"token": VALID_EXPO_TOKEN},
        )

        assert resp.status_code == 422

    def test_profile_not_found(self, client):
        mock_sb = _make_mock_user_sb(data=[])

        with patch("app.api.v1.notifications.get_user_supabase", return_value=mock_sb):
            resp = client.post(
                "/api/v1/notifications/register-token",
                json={"token": VALID_EXPO_TOKEN},
                headers=AUTH_HEADERS,
            )

        assert resp.status_code == 404
        assert resp.json()["detail"] == "Profile not found"

    def test_supabase_raises_exception(self, client):
        mock_sb = MagicMock()
        mock_sb.table.return_value.update.return_value.eq.return_value.execute.side_effect = Exception(
            "DB connection error"
        )

        with patch("app.api.v1.notifications.get_user_supabase", return_value=mock_sb):
            resp = client.post(
                "/api/v1/notifications/register-token",
                json={"token": VALID_EXPO_TOKEN},
                headers=AUTH_HEADERS,
            )

        assert resp.status_code == 500
        assert resp.json()["detail"] == "Failed to register push token"


SEND_BODY = {"to_user_id": "user-456", "title": "Hello", "body": "World", "data": {}}


class TestSendNotification:
    def test_send_success(self, client):
        mock_sb = _make_mock_admin_sb()
        mock_send = AsyncMock(return_value={"data": [{"status": "ok"}]})

        with patch("app.api.v1.notifications.get_supabase", return_value=mock_sb), \
             patch("app.api.v1.notifications.send_push_notification", mock_send):
            resp = client.post(
                "/api/v1/notifications/send",
                json=SEND_BODY,
                headers=AUTH_HEADERS,
            )

        assert resp.status_code == 200
        assert resp.json()["success"] is True

    def test_send_user_not_found(self, client):
        mock_sb = _make_mock_admin_sb(push_token=None)
        # Supabase returns empty list — no record at all
        mock_sb.table.return_value.select.return_value.eq.return_value.execute.return_value.data = []

        with patch("app.api.v1.notifications.get_supabase", return_value=mock_sb):
            resp = client.post(
                "/api/v1/notifications/send",
                json=SEND_BODY,
                headers=AUTH_HEADERS,
            )

        assert resp.status_code == 404

    def test_send_no_token_registered(self, client):
        mock_sb = _make_mock_admin_sb(push_token=None)

        with patch("app.api.v1.notifications.get_supabase", return_value=mock_sb):
            resp = client.post(
                "/api/v1/notifications/send",
                json=SEND_BODY,
                headers=AUTH_HEADERS,
            )

        assert resp.status_code == 404

    def test_send_expo_service_error(self, client):
        import httpx

        mock_sb = _make_mock_admin_sb()
        mock_send = AsyncMock(side_effect=httpx.HTTPError("Expo unreachable"))

        with patch("app.api.v1.notifications.get_supabase", return_value=mock_sb), \
             patch("app.api.v1.notifications.send_push_notification", mock_send):
            resp = client.post(
                "/api/v1/notifications/send",
                json=SEND_BODY,
                headers=AUTH_HEADERS,
            )

        assert resp.status_code == 502

    def test_send_unexpected_error(self, client):
        mock_sb = _make_mock_admin_sb()
        mock_send = AsyncMock(side_effect=Exception("unexpected"))

        with patch("app.api.v1.notifications.get_supabase", return_value=mock_sb), \
             patch("app.api.v1.notifications.send_push_notification", mock_send):
            resp = client.post(
                "/api/v1/notifications/send",
                json=SEND_BODY,
                headers=AUTH_HEADERS,
            )

        assert resp.status_code == 500

    def test_send_requires_auth(self):
        raw_client = TestClient(app)
        resp = raw_client.post(
            "/api/v1/notifications/send",
            json=SEND_BODY,
        )

        assert resp.status_code == 422

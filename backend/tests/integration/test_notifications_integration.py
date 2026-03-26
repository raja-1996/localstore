"""
Integration tests for /api/v1/notifications endpoints.

Requires a running Supabase instance. Automatically skipped if unavailable.
The push_token column must exist on profiles (migration 002_add_push_token.sql).
"""
import pytest

from tests.integration.conftest import skip_if_no_supabase

pytestmark = skip_if_no_supabase

VALID_EXPO_TOKEN = "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]"


class TestRegisterTokenIntegration:
    def test_register_token_success(self, integration_client, test_user):
        resp = integration_client.post(
            "/api/v1/notifications/register-token",
            json={"token": VALID_EXPO_TOKEN},
            headers=test_user["auth_headers"],
        )
        assert resp.status_code == 200
        assert resp.json()["message"] == "Token registered successfully"

    def test_register_token_persisted_in_db(self, integration_client, test_user):
        """Token is actually saved to profiles.push_token."""
        resp = integration_client.post(
            "/api/v1/notifications/register-token",
            json={"token": VALID_EXPO_TOKEN},
            headers=test_user["auth_headers"],
        )
        assert resp.status_code == 200

        from app.core.supabase import get_supabase
        result = get_supabase().table("profiles").select("push_token").eq("id", test_user["user_id"]).execute()
        assert result.data
        assert result.data[0]["push_token"] == VALID_EXPO_TOKEN

    def test_register_token_can_be_updated(self, integration_client, test_user):
        """Calling register-token again replaces the old token."""
        new_token = "ExponentPushToken[yyyyyyyyyyyyyyyyyyyy]"
        integration_client.post(
            "/api/v1/notifications/register-token",
            json={"token": VALID_EXPO_TOKEN},
            headers=test_user["auth_headers"],
        )
        resp = integration_client.post(
            "/api/v1/notifications/register-token",
            json={"token": new_token},
            headers=test_user["auth_headers"],
        )
        assert resp.status_code == 200

        from app.core.supabase import get_supabase
        result = get_supabase().table("profiles").select("push_token").eq("id", test_user["user_id"]).execute()
        assert result.data[0]["push_token"] == new_token

    def test_register_token_requires_auth(self, integration_client):
        resp = integration_client.post(
            "/api/v1/notifications/register-token",
            json={"token": VALID_EXPO_TOKEN},
        )
        assert resp.status_code == 422

    def test_register_token_invalid_format(self, integration_client, test_user):
        resp = integration_client.post(
            "/api/v1/notifications/register-token",
            json={"token": "not-a-valid-token!@#"},
            headers=test_user["auth_headers"],
        )
        assert resp.status_code == 422

    def test_register_token_empty_token(self, integration_client, test_user):
        resp = integration_client.post(
            "/api/v1/notifications/register-token",
            json={"token": "   "},
            headers=test_user["auth_headers"],
        )
        assert resp.status_code == 422

    def test_register_token_missing_body(self, integration_client, test_user):
        resp = integration_client.post(
            "/api/v1/notifications/register-token",
            json={},
            headers=test_user["auth_headers"],
        )
        assert resp.status_code == 422


class TestSendNotificationIntegration:
    def test_send_to_self_success(self, integration_client, test_user):
        """Register token first, then send — may get 502 if Expo rejects fake token."""
        integration_client.post(
            "/api/v1/notifications/register-token",
            json={"token": VALID_EXPO_TOKEN},
            headers=test_user["auth_headers"],
        )

        resp = integration_client.post(
            "/api/v1/notifications/send",
            json={
                "to_user_id": test_user["user_id"],
                "title": "Test",
                "body": "Hello from integration test",
                "data": {},
            },
            headers=test_user["auth_headers"],
        )

        # 200 if Expo accepts the token; 502 if Expo rejects the fake token
        assert resp.status_code in (200, 502)

    def test_send_to_nonexistent_user(self, integration_client, test_user):
        import uuid

        resp = integration_client.post(
            "/api/v1/notifications/send",
            json={
                "to_user_id": str(uuid.uuid4()),
                "title": "Ghost",
                "body": "Nobody home",
                "data": {},
            },
            headers=test_user["auth_headers"],
        )

        assert resp.status_code == 404

    def test_send_requires_auth(self, integration_client):
        resp = integration_client.post(
            "/api/v1/notifications/send",
            json={
                "to_user_id": "any-id",
                "title": "No auth",
                "body": "Should fail",
                "data": {},
            },
        )

        assert resp.status_code == 422

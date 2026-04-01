"""
Integration tests for push notification on chat message (Sprint 11).

Requires a running Supabase instance with chat migrations applied.
Automatically skipped if Supabase is unreachable.

Tests use real Supabase for all DB operations but mock push_service.send_push
to avoid hitting the Expo Push API.
"""
from unittest.mock import AsyncMock, patch

import pytest

from tests.integration.conftest import (
    skip_if_no_supabase,
    make_merchant_payload,
    delete_merchant,
)

pytestmark = [skip_if_no_supabase]


# ---------------------------------------------------------------------------
# Service-role helper
# ---------------------------------------------------------------------------

def _get_service_client():
    """Return a service-role Supabase client (bypasses RLS)."""
    from supabase import create_client
    from app.core.config import settings
    return create_client(settings.supabase_url, settings.supabase_secret_default_key)


# ---------------------------------------------------------------------------
# Cleanup helper
# ---------------------------------------------------------------------------

def delete_chat_thread(thread_id: str) -> None:
    """Hard-delete a chat thread and its messages via service-role client."""
    try:
        svc = _get_service_client()
        svc.table("chat_messages").delete().eq("thread_id", thread_id).execute()
        svc.table("chat_threads").delete().eq("id", thread_id).execute()
    except Exception as e:
        print(f"Warning: delete_chat_thread failed for {thread_id}: {e}")


def _register_push_token(client, headers, token: str) -> None:
    """Register a push token for a user via the API."""
    resp = client.put(
        "/api/v1/users/me/push-token",
        json={"token": token},
        headers=headers,
    )
    assert resp.status_code == 200, f"Push token registration failed: {resp.text}"


def _clear_push_token(user_id: str) -> None:
    """Clear push_token from profiles via service-role client."""
    try:
        svc = _get_service_client()
        svc.table("profiles").update({"push_token": None}).eq("id", user_id).execute()
    except Exception as e:
        print(f"Warning: clear push_token failed for {user_id}: {e}")


# ---------------------------------------------------------------------------
# TestPushOnChatMessage
# ---------------------------------------------------------------------------

class TestPushOnChatMessage:
    """Sprint 11 integration tests: push notification triggered on chat message."""

    @pytest.fixture(scope="class")
    def merchant_for_push(self, integration_client, test_user_b):
        """Create a merchant owned by test_user_b; clean up after the class."""
        payload = make_merchant_payload()
        resp = integration_client.post(
            "/api/v1/merchants",
            json=payload,
            headers=test_user_b["auth_headers"],
        )
        assert resp.status_code == 201, f"merchant_for_push setup failed: {resp.text}"
        merchant_id = resp.json()["id"]
        yield resp.json()
        delete_merchant(merchant_id)

    # ------------------------------------------------------------------
    # 1. test_send_message_triggers_push_task
    # ------------------------------------------------------------------

    def test_send_message_triggers_push_task(
        self, integration_client, test_user, test_user_b, merchant_for_push
    ):
        """
        User A sends a message to a thread with merchant owned by User B.
        User B has a push token registered.
        Assert: push_service.send_push is called once with User B's token.
        """
        thread_id = None
        push_token = "ExponentPushToken[push-integration-test]"
        try:
            # Register push token for User B (merchant owner = recipient)
            _register_push_token(
                integration_client,
                test_user_b["auth_headers"],
                push_token,
            )

            # User A creates a chat thread with the merchant
            create_resp = integration_client.post(
                "/api/v1/chats",
                json={"merchant_id": merchant_for_push["id"]},
                headers=test_user["auth_headers"],
            )
            assert create_resp.status_code in (200, 201), create_resp.text
            thread_id = create_resp.json()["id"]

            # Mock send_push so we don't hit Expo, but let all DB ops be real
            mock_send = AsyncMock(return_value={"status": "ok", "id": "test-ticket"})
            with patch("app.services.push_service.send_push", mock_send):
                msg_resp = integration_client.post(
                    f"/api/v1/chats/{thread_id}/messages",
                    json={"content": "Hello from push integration test"},
                    headers=test_user["auth_headers"],
                )
                assert msg_resp.status_code == 201, msg_resp.text

            # FastAPI TestClient runs BackgroundTasks synchronously,
            # so send_push should have been called by now.
            mock_send.assert_called_once()

            # Verify the call args
            call_args = mock_send.call_args
            # First positional arg is the token
            assert call_args[0][0] == push_token, (
                f"Expected token={push_token}, got {call_args[0][0]}"
            )
            # Title should contain sender name
            assert "message from" in call_args[0][1].lower(), (
                f"Expected title containing 'message from', got {call_args[0][1]}"
            )
            # Body is the message preview
            assert call_args[0][2] == "Hello from push integration test"
            # Data payload should include threadId and screen
            data_arg = call_args[0][3] if len(call_args[0]) > 3 else call_args[1].get("data", {})
            assert data_arg.get("threadId") == thread_id
            assert data_arg.get("screen") == "chat"

        finally:
            if thread_id:
                delete_chat_thread(thread_id)
            # Clean up push token
            _clear_push_token(test_user_b["user_id"])

    # ------------------------------------------------------------------
    # 2. test_send_message_no_push_if_recipient_has_no_token
    # ------------------------------------------------------------------

    def test_send_message_no_push_if_recipient_has_no_token(
        self, integration_client, test_user, test_user_b, merchant_for_push
    ):
        """
        User A sends a message to a thread with merchant owned by User B.
        User B has NO push token registered.
        Assert: push_service.send_push is NOT called.
        """
        thread_id = None
        try:
            # Ensure User B has no push token
            _clear_push_token(test_user_b["user_id"])

            # User A creates a chat thread with the merchant
            create_resp = integration_client.post(
                "/api/v1/chats",
                json={"merchant_id": merchant_for_push["id"]},
                headers=test_user["auth_headers"],
            )
            assert create_resp.status_code in (200, 201), create_resp.text
            thread_id = create_resp.json()["id"]

            # Mock send_push — it should NOT be called
            mock_send = AsyncMock(return_value={"status": "ok", "id": "test-ticket"})
            with patch("app.services.push_service.send_push", mock_send):
                msg_resp = integration_client.post(
                    f"/api/v1/chats/{thread_id}/messages",
                    json={"content": "No push expected for this message"},
                    headers=test_user["auth_headers"],
                )
                assert msg_resp.status_code == 201, msg_resp.text

            # send_push should NOT have been called (no token registered)
            mock_send.assert_not_called()

            # Verify the message was still saved correctly
            body = msg_resp.json()
            assert body["content"] == "No push expected for this message"
            assert body["sender_id"] == test_user["user_id"]

        finally:
            if thread_id:
                delete_chat_thread(thread_id)

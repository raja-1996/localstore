"""
Unit tests for push_service.py — Expo Push API dispatch + token lookup helpers (Sprint 11).

Supabase is fully mocked — no live instance required.
httpx is mocked via unittest.mock — no real HTTP requests.
"""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

import httpx

from app.services.push_service import (
    BATCH_SIZE,
    EXPO_PUSH_URL,
    get_follower_push_tokens,
    get_recipient_push_token,
    get_sender_name,
    send_bulk_push,
    send_push,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_mock_sb():
    """Create a blank MagicMock Supabase client."""
    return MagicMock()


def _mock_async_client_post(json_response, status_code=200):
    """Build a patched httpx.AsyncClient whose .post() returns the given JSON."""
    mock_resp = MagicMock()
    mock_resp.status_code = status_code
    mock_resp.json.return_value = json_response
    mock_resp.raise_for_status = MagicMock()

    mock_client = AsyncMock()
    mock_client.post = AsyncMock(return_value=mock_resp)
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=False)
    return mock_client


# ---------------------------------------------------------------------------
# TestSendPush
# ---------------------------------------------------------------------------

class TestSendPush:
    """Tests for send_push() — single push via Expo Push API."""

    @pytest.mark.asyncio
    async def test_send_push_success(self):
        """200 response with status ok returns ticket dict."""
        mock_client = _mock_async_client_post(
            {"data": {"status": "ok", "id": "ticket-abc"}}
        )
        with patch("app.services.push_service.httpx.AsyncClient", return_value=mock_client):
            result = await send_push(
                "ExponentPushToken[xxx]", "Title", "Body", {"key": "val"}
            )

        assert result == {"status": "ok", "id": "ticket-abc"}
        mock_client.post.assert_called_once()

    @pytest.mark.asyncio
    async def test_send_push_invalid_token(self):
        """DeviceNotRegistered error returns error dict (no exception)."""
        mock_client = _mock_async_client_post(
            {"data": {"status": "error", "details": {"error": "DeviceNotRegistered"}}}
        )
        with patch("app.services.push_service.httpx.AsyncClient", return_value=mock_client):
            result = await send_push("ExponentPushToken[bad]", "Title", "Body")

        assert result["status"] == "error"
        assert result["details"]["error"] == "DeviceNotRegistered"

    @pytest.mark.asyncio
    async def test_send_push_network_error(self):
        """httpx.ConnectError returns error dict with message."""
        mock_client = AsyncMock()
        mock_client.post = AsyncMock(side_effect=httpx.ConnectError("connection refused"))
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)

        with patch("app.services.push_service.httpx.AsyncClient", return_value=mock_client):
            result = await send_push("ExponentPushToken[xxx]", "Title", "Body")

        assert result["status"] == "error"
        assert "connection refused" in result["message"]

    @pytest.mark.asyncio
    async def test_send_push_payload_format(self):
        """Request body contains required keys: to, title, body, data, sound."""
        mock_client = _mock_async_client_post({"data": {"status": "ok", "id": "t1"}})
        with patch("app.services.push_service.httpx.AsyncClient", return_value=mock_client):
            await send_push(
                "ExponentPushToken[xxx]", "My Title", "My Body", {"screen": "chat"}
            )

        call_kwargs = mock_client.post.call_args
        payload = call_kwargs.kwargs.get("json") or call_kwargs[1].get("json")
        assert payload["to"] == "ExponentPushToken[xxx]"
        assert payload["title"] == "My Title"
        assert payload["body"] == "My Body"
        assert payload["data"] == {"screen": "chat"}
        assert payload["sound"] == "default"


# ---------------------------------------------------------------------------
# TestSendBulkPush
# ---------------------------------------------------------------------------

class TestSendBulkPush:
    """Tests for send_bulk_push() — batch push to multiple tokens."""

    @pytest.mark.asyncio
    async def test_bulk_push_under_batch_size(self):
        """50 tokens -> 1 POST call."""
        tokens = [f"ExponentPushToken[{i}]" for i in range(50)]
        tickets = [{"status": "ok", "id": f"t-{i}"} for i in range(50)]
        mock_client = _mock_async_client_post({"data": tickets})

        with patch("app.services.push_service.httpx.AsyncClient", return_value=mock_client):
            result = await send_bulk_push(tokens, "Title", "Body")

        assert mock_client.post.call_count == 1
        assert len(result) == 50

    @pytest.mark.asyncio
    async def test_bulk_push_exact_batch_size(self):
        """100 tokens -> 1 POST call."""
        tokens = [f"ExponentPushToken[{i}]" for i in range(100)]
        tickets = [{"status": "ok", "id": f"t-{i}"} for i in range(100)]
        mock_client = _mock_async_client_post({"data": tickets})

        with patch("app.services.push_service.httpx.AsyncClient", return_value=mock_client):
            result = await send_bulk_push(tokens, "Title", "Body")

        assert mock_client.post.call_count == 1
        assert len(result) == 100

    @pytest.mark.asyncio
    async def test_bulk_push_over_batch_size(self):
        """150 tokens -> 2 POST calls (100 + 50)."""
        tokens = [f"ExponentPushToken[{i}]" for i in range(150)]
        # Each call returns its batch of tickets
        batch1 = [{"status": "ok", "id": f"t-{i}"} for i in range(100)]
        batch2 = [{"status": "ok", "id": f"t-{i}"} for i in range(100, 150)]

        mock_resp_1 = MagicMock()
        mock_resp_1.json.return_value = {"data": batch1}
        mock_resp_1.raise_for_status = MagicMock()

        mock_resp_2 = MagicMock()
        mock_resp_2.json.return_value = {"data": batch2}
        mock_resp_2.raise_for_status = MagicMock()

        mock_client = AsyncMock()
        mock_client.post = AsyncMock(side_effect=[mock_resp_1, mock_resp_2])
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)

        with patch("app.services.push_service.httpx.AsyncClient", return_value=mock_client):
            result = await send_bulk_push(tokens, "Title", "Body")

        assert mock_client.post.call_count == 2
        assert len(result) == 150

    @pytest.mark.asyncio
    async def test_bulk_push_empty_tokens(self):
        """0 tokens -> 0 POST calls, returns empty list."""
        mock_client = _mock_async_client_post({"data": []})
        with patch("app.services.push_service.httpx.AsyncClient", return_value=mock_client):
            result = await send_bulk_push([], "Title", "Body")

        assert result == []
        mock_client.post.assert_not_called()


# ---------------------------------------------------------------------------
# TestGetRecipientPushToken
# ---------------------------------------------------------------------------

class TestGetRecipientPushToken:
    """Tests for get_recipient_push_token() — sync Supabase lookup."""

    def test_get_token_sender_is_user(self):
        """When sender == thread.user_id, recipient is merchant owner."""
        mock_sb = _make_mock_sb()

        # Thread query
        thread_exec = MagicMock()
        thread_exec.data = {
            "user_id": "sender-1",
            "merchant_id": "m-1",
            "merchants": {"user_id": "merchant-owner-1"},
        }
        (
            mock_sb.table.return_value
            .select.return_value
            .eq.return_value
            .single.return_value
            .execute
        ).return_value = thread_exec

        # Profile query (second .table() call)
        profile_exec = MagicMock()
        profile_exec.data = {"push_token": "ExponentPushToken[owner]"}

        # Use side_effect to handle two .table() calls
        thread_table = MagicMock()
        thread_table.select.return_value.eq.return_value.single.return_value.execute.return_value = thread_exec

        profile_table = MagicMock()
        profile_table.select.return_value.eq.return_value.single.return_value.execute.return_value = profile_exec

        mock_sb.table.side_effect = [thread_table, profile_table]

        result = get_recipient_push_token(mock_sb, "thread-1", "sender-1")
        assert result == "ExponentPushToken[owner]"

    def test_get_token_sender_is_merchant_owner(self):
        """When sender == merchant owner, recipient is thread.user_id."""
        mock_sb = _make_mock_sb()

        thread_exec = MagicMock()
        thread_exec.data = {
            "user_id": "customer-1",
            "merchant_id": "m-1",
            "merchants": {"user_id": "merchant-owner-1"},
        }

        profile_exec = MagicMock()
        profile_exec.data = {"push_token": "ExponentPushToken[customer]"}

        thread_table = MagicMock()
        thread_table.select.return_value.eq.return_value.single.return_value.execute.return_value = thread_exec

        profile_table = MagicMock()
        profile_table.select.return_value.eq.return_value.single.return_value.execute.return_value = profile_exec

        mock_sb.table.side_effect = [thread_table, profile_table]

        result = get_recipient_push_token(mock_sb, "thread-1", "merchant-owner-1")
        assert result == "ExponentPushToken[customer]"

    def test_get_token_no_push_token(self):
        """Recipient has no push_token -> returns None."""
        mock_sb = _make_mock_sb()

        thread_exec = MagicMock()
        thread_exec.data = {
            "user_id": "sender-1",
            "merchant_id": "m-1",
            "merchants": {"user_id": "owner-1"},
        }

        profile_exec = MagicMock()
        profile_exec.data = {"push_token": None}

        thread_table = MagicMock()
        thread_table.select.return_value.eq.return_value.single.return_value.execute.return_value = thread_exec

        profile_table = MagicMock()
        profile_table.select.return_value.eq.return_value.single.return_value.execute.return_value = profile_exec

        mock_sb.table.side_effect = [thread_table, profile_table]

        result = get_recipient_push_token(mock_sb, "thread-1", "sender-1")
        assert result is None

    def test_get_token_thread_not_found(self):
        """Thread query raises exception -> returns None."""
        mock_sb = _make_mock_sb()

        thread_table = MagicMock()
        thread_table.select.return_value.eq.return_value.single.return_value.execute.side_effect = Exception(
            "not found"
        )
        mock_sb.table.return_value = thread_table

        result = get_recipient_push_token(mock_sb, "missing-thread", "sender-1")
        assert result is None


# ---------------------------------------------------------------------------
# TestGetSenderName
# ---------------------------------------------------------------------------

class TestGetSenderName:
    """Tests for get_sender_name() — sync Supabase lookup."""

    def test_get_sender_name_success(self):
        """Returns full_name from profiles."""
        mock_sb = _make_mock_sb()
        exec_result = MagicMock()
        exec_result.data = {"full_name": "Alice"}
        mock_sb.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value = exec_result

        assert get_sender_name(mock_sb, "user-1") == "Alice"

    def test_get_sender_name_not_found(self):
        """Missing profile returns 'Someone'."""
        mock_sb = _make_mock_sb()
        exec_result = MagicMock()
        exec_result.data = None
        mock_sb.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value = exec_result

        assert get_sender_name(mock_sb, "missing-user") == "Someone"

    def test_get_sender_name_exception(self):
        """DB error returns 'Someone'."""
        mock_sb = _make_mock_sb()
        mock_sb.table.return_value.select.return_value.eq.return_value.single.return_value.execute.side_effect = Exception(
            "db error"
        )

        assert get_sender_name(mock_sb, "user-1") == "Someone"


# ---------------------------------------------------------------------------
# TestGetFollowerPushTokens
# ---------------------------------------------------------------------------

class TestGetFollowerPushTokens:
    """Tests for get_follower_push_tokens() — sync Supabase lookup."""

    def test_get_follower_tokens_success(self):
        """3 followers with tokens + 1 without -> returns 3 tokens."""
        mock_sb = _make_mock_sb()

        follows_exec = MagicMock()
        follows_exec.data = [
            {"user_id": "u1"},
            {"user_id": "u2"},
            {"user_id": "u3"},
            {"user_id": "u4"},
        ]

        profiles_exec = MagicMock()
        profiles_exec.data = [
            {"id": "u1", "push_token": "ExponentPushToken[1]"},
            {"id": "u2", "push_token": "ExponentPushToken[2]"},
            {"id": "u3", "push_token": "ExponentPushToken[3]"},
            {"id": "u4", "push_token": None},
        ]

        follows_table = MagicMock()
        follows_table.select.return_value.eq.return_value.execute.return_value = follows_exec

        profiles_table = MagicMock()
        profiles_table.select.return_value.in_.return_value.execute.return_value = profiles_exec

        mock_sb.table.side_effect = [follows_table, profiles_table]

        result = get_follower_push_tokens(mock_sb, "merchant-1")
        assert len(result) == 3
        assert "ExponentPushToken[1]" in result
        assert "ExponentPushToken[2]" in result
        assert "ExponentPushToken[3]" in result

    def test_get_follower_tokens_no_followers(self):
        """0 follows rows -> returns empty list."""
        mock_sb = _make_mock_sb()

        follows_exec = MagicMock()
        follows_exec.data = []

        follows_table = MagicMock()
        follows_table.select.return_value.eq.return_value.execute.return_value = follows_exec

        mock_sb.table.return_value = follows_table

        result = get_follower_push_tokens(mock_sb, "merchant-1")
        assert result == []

    def test_get_follower_tokens_all_without_tokens(self):
        """2 followers, both push_token=None -> returns empty list."""
        mock_sb = _make_mock_sb()

        follows_exec = MagicMock()
        follows_exec.data = [{"user_id": "u1"}, {"user_id": "u2"}]

        profiles_exec = MagicMock()
        profiles_exec.data = [
            {"id": "u1", "push_token": None},
            {"id": "u2", "push_token": None},
        ]

        follows_table = MagicMock()
        follows_table.select.return_value.eq.return_value.execute.return_value = follows_exec

        profiles_table = MagicMock()
        profiles_table.select.return_value.in_.return_value.execute.return_value = profiles_exec

        mock_sb.table.side_effect = [follows_table, profiles_table]

        result = get_follower_push_tokens(mock_sb, "merchant-1")
        assert result == []

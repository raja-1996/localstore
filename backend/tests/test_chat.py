"""
Unit tests for /api/v1/chats endpoints (Sprint 9).

Supabase is fully mocked — no live instance required.
The `client` fixture (from conftest.py) overrides `get_current_user` with MOCK_USER.
Each test patches `app.api.v1.chat.get_user_supabase` to control DB responses.
"""
from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient

from app.main import app
from tests.conftest import AUTH_HEADERS, MOCK_USER

# ---------------------------------------------------------------------------
# Test constants
# ---------------------------------------------------------------------------

MOCK_USER_ID = "user-123"          # same as MOCK_USER["id"] from conftest
MERCHANT_OWNER_ID = "merchant-owner-456"
MOCK_THREAD_ID = "thread-001"
MOCK_MERCHANT_ID = "merchant-001"
MOCK_MSG_ID = "msg-001"

MOCK_THREAD_ROW = {
    "id": MOCK_THREAD_ID,
    "user_id": MOCK_USER_ID,
    "merchant_id": MOCK_MERCHANT_ID,
    "last_message_at": "2024-06-01T12:00:00+00:00",
    "unread_user_count": 3,
    "unread_merchant_count": 1,
    "created_at": "2024-06-01T10:00:00+00:00",
    "merchants": {
        "id": MOCK_MERCHANT_ID,
        "name": "Test Shop",
        "user_id": MERCHANT_OWNER_ID,
        "avatar_url": None,
    },
}

MOCK_MESSAGE_ROW = {
    "id": MOCK_MSG_ID,
    "thread_id": MOCK_THREAD_ID,
    "sender_id": MOCK_USER_ID,
    "content": "Hello!",
    "read_by_user": True,
    "read_by_merchant": False,
    "created_at": "2024-06-01T12:00:00+00:00",
}

PATCH_TARGET = "app.api.v1.chat.get_user_supabase"


# ---------------------------------------------------------------------------
# Mock builder helpers
# ---------------------------------------------------------------------------

def _make_mock_sb():
    return MagicMock()


def _make_select_list_mock(rows):
    """Build a SELECT chain that returns a list of rows."""
    mock = MagicMock()
    execute_result = MagicMock()
    execute_result.data = rows
    mock.select.return_value.order.return_value.limit.return_value.execute.return_value = execute_result
    return mock


def _make_select_list_with_before_mock(rows):
    """SELECT chain including .lt() cursor filter."""
    mock = MagicMock()
    execute_result = MagicMock()
    execute_result.data = rows
    (
        mock.select.return_value
        .order.return_value
        .limit.return_value
        .execute.return_value
    ) = execute_result
    (
        mock.select.return_value
        .order.return_value
        .limit.return_value
        .lt.return_value
        .execute.return_value
    ) = execute_result
    return mock


def _make_eq_select_mock(rows):
    """Build a SELECT...eq() chain returning rows."""
    mock = MagicMock()
    execute_result = MagicMock()
    execute_result.data = rows
    mock.select.return_value.eq.return_value.execute.return_value = execute_result
    return mock


def _make_in_select_mock(rows):
    """SELECT...in_().order().limit() chain for batch last-message fetch."""
    mock = MagicMock()
    execute_result = MagicMock()
    execute_result.data = rows
    (
        mock.select.return_value
        .in_.return_value
        .order.return_value
        .limit.return_value
        .execute.return_value
    ) = execute_result
    return mock


def _make_eq_eq_select_mock(rows):
    """SELECT...eq()...eq() chain (for existing thread check)."""
    mock = MagicMock()
    execute_result = MagicMock()
    execute_result.data = rows
    mock.select.return_value.eq.return_value.eq.return_value.execute.return_value = execute_result
    return mock


def _make_eq_eq_order_limit_mock(rows):
    """SELECT...eq()...order()...limit() chain for messages with thread filter."""
    mock = MagicMock()
    execute_result = MagicMock()
    execute_result.data = rows
    (
        mock.select.return_value
        .eq.return_value
        .order.return_value
        .limit.return_value
        .execute.return_value
    ) = execute_result
    (
        mock.select.return_value
        .eq.return_value
        .order.return_value
        .limit.return_value
        .lt.return_value
        .execute.return_value
    ) = execute_result
    return mock


def _make_insert_mock(row):
    """INSERT returning single row."""
    mock = MagicMock()
    execute_result = MagicMock()
    execute_result.data = [row]
    mock.insert.return_value.execute.return_value = execute_result
    return mock


def _make_update_eq_eq_mock(rows):
    """UPDATE...eq()...eq() chain for mark-read messages."""
    mock = MagicMock()
    execute_result = MagicMock()
    execute_result.data = rows
    (
        mock.update.return_value
        .eq.return_value
        .eq.return_value
        .execute.return_value
    ) = execute_result
    return mock


def _make_update_eq_mock(rows=None):
    """UPDATE...eq() chain for resetting unread counter on thread."""
    mock = MagicMock()
    execute_result = MagicMock()
    execute_result.data = rows or []
    mock.update.return_value.eq.return_value.execute.return_value = execute_result
    return mock


# ---------------------------------------------------------------------------
# TestListChatThreads — GET /chats
# ---------------------------------------------------------------------------

class TestListChatThreads:
    def test_list_threads_success(self, client):
        """GET /chats — 200 with 2 threads; merchant stub present."""
        thread2 = {**MOCK_THREAD_ROW, "id": "thread-002"}
        rows = [MOCK_THREAD_ROW, thread2]

        mock_sb = _make_mock_sb()
        # Call 1: list chat_threads
        threads_table = _make_select_list_mock(rows)
        # Call 2: batch last messages
        msgs_table = _make_in_select_mock([
            {"thread_id": MOCK_THREAD_ID, "content": "Hello!", "created_at": "2024-06-01T12:00:00+00:00"},
        ])
        mock_sb.table.side_effect = [threads_table, msgs_table]

        with patch(PATCH_TARGET, return_value=mock_sb):
            resp = client.get("/api/v1/chats", headers=AUTH_HEADERS)

        assert resp.status_code == 200
        body = resp.json()
        assert len(body["data"]) == 2
        assert body["data"][0]["merchant"]["name"] == "Test Shop"
        assert body["data"][0]["merchant"]["id"] == MOCK_MERCHANT_ID

    def test_list_threads_empty(self, client):
        """GET /chats — 200 with empty data list when no threads."""
        mock_sb = _make_mock_sb()
        threads_table = _make_select_list_mock([])
        mock_sb.table.return_value = threads_table

        with patch(PATCH_TARGET, return_value=mock_sb):
            resp = client.get("/api/v1/chats", headers=AUTH_HEADERS)

        assert resp.status_code == 200
        body = resp.json()
        assert body["data"] == []
        assert body["has_more"] is False

    def test_list_threads_cursor_pagination(self, client):
        """GET /chats — limit+1 rows; has_more=True, next_cursor set."""
        rows = [
            {**MOCK_THREAD_ROW, "id": f"thread-{i:03d}", "last_message_at": f"2024-06-{i+1:02d}T10:00:00+00:00"}
            for i in range(21)  # limit=20, +1 = 21 rows
        ]
        mock_sb = _make_mock_sb()
        threads_table = _make_select_list_mock(rows)
        msgs_table = _make_in_select_mock([])
        mock_sb.table.side_effect = [threads_table, msgs_table]

        with patch(PATCH_TARGET, return_value=mock_sb):
            resp = client.get("/api/v1/chats?limit=20", headers=AUTH_HEADERS)

        assert resp.status_code == 200
        body = resp.json()
        assert body["has_more"] is True
        assert body["next_cursor"] is not None
        assert len(body["data"]) == 20

    def test_list_threads_unread_count_user(self, client):
        """GET /chats — caller is thread.user_id; unread_count = unread_user_count."""
        # MOCK_USER_ID == MOCK_THREAD_ROW["user_id"] == "user-123"
        # unread_user_count = 3
        mock_sb = _make_mock_sb()
        threads_table = _make_select_list_mock([MOCK_THREAD_ROW])
        msgs_table = _make_in_select_mock([])
        mock_sb.table.side_effect = [threads_table, msgs_table]

        with patch(PATCH_TARGET, return_value=mock_sb):
            resp = client.get("/api/v1/chats", headers=AUTH_HEADERS)

        assert resp.status_code == 200
        assert resp.json()["data"][0]["unread_count"] == 3  # unread_user_count

    def test_list_threads_unread_count_merchant(self, client):
        """GET /chats — caller is merchant owner; unread_count = unread_merchant_count."""
        # Override MOCK_USER to be the merchant owner
        from app.core.auth import get_current_user
        merchant_caller = {"id": MERCHANT_OWNER_ID, "email": "merchant@test.com", "token": "tok"}
        app.dependency_overrides[get_current_user] = lambda: merchant_caller

        thread_row = {**MOCK_THREAD_ROW}  # merchants.user_id = MERCHANT_OWNER_ID
        mock_sb = _make_mock_sb()
        threads_table = _make_select_list_mock([thread_row])
        msgs_table = _make_in_select_mock([])
        mock_sb.table.side_effect = [threads_table, msgs_table]

        with patch(PATCH_TARGET, return_value=mock_sb):
            resp = client.get("/api/v1/chats", headers=AUTH_HEADERS)

        app.dependency_overrides.clear()
        app.dependency_overrides[get_current_user] = lambda: MOCK_USER

        assert resp.status_code == 200
        assert resp.json()["data"][0]["unread_count"] == 1  # unread_merchant_count


# ---------------------------------------------------------------------------
# TestCreateChatThread — POST /chats
# ---------------------------------------------------------------------------

class TestCreateChatThread:
    def test_create_thread_new(self, client):
        """POST /chats — no existing thread; INSERT succeeds; 201."""
        inserted_row = {
            "id": MOCK_THREAD_ID,
            "user_id": MOCK_USER_ID,
            "merchant_id": MOCK_MERCHANT_ID,
            "last_message_at": None,
            "unread_user_count": 0,
            "unread_merchant_count": 0,
            "created_at": "2024-06-01T10:00:00+00:00",
        }
        merchant_row = {
            "id": MOCK_MERCHANT_ID,
            "name": "Test Shop",
            "user_id": MERCHANT_OWNER_ID,
            "avatar_url": None,
        }

        mock_sb = _make_mock_sb()
        # Call 1: verify merchant exists
        merchant_table = _make_mock_sb()
        merchant_table.select.return_value.eq.return_value.execute.return_value.data = [merchant_row]
        # Call 2: check existing thread (empty)
        existing_table = _make_eq_eq_select_mock([])
        # Call 3: INSERT new thread
        insert_table = _make_insert_mock(inserted_row)
        mock_sb.table.side_effect = [merchant_table, existing_table, insert_table]

        with patch(PATCH_TARGET, return_value=mock_sb):
            resp = client.post(
                "/api/v1/chats",
                json={"merchant_id": MOCK_MERCHANT_ID},
                headers=AUTH_HEADERS,
            )

        assert resp.status_code == 201
        body = resp.json()
        assert body["id"] == MOCK_THREAD_ID
        assert body["merchant_id"] == MOCK_MERCHANT_ID

    def test_create_thread_existing(self, client):
        """POST /chats — existing thread found; returns 200."""
        merchant_row = {
            "id": MOCK_MERCHANT_ID,
            "name": "Test Shop",
            "user_id": MERCHANT_OWNER_ID,
            "avatar_url": None,
        }

        mock_sb = _make_mock_sb()
        merchant_table = _make_mock_sb()
        merchant_table.select.return_value.eq.return_value.execute.return_value.data = [merchant_row]
        existing_table = _make_eq_eq_select_mock([MOCK_THREAD_ROW])
        mock_sb.table.side_effect = [merchant_table, existing_table]

        with patch(PATCH_TARGET, return_value=mock_sb):
            resp = client.post(
                "/api/v1/chats",
                json={"merchant_id": MOCK_MERCHANT_ID},
                headers=AUTH_HEADERS,
            )

        assert resp.status_code == 200
        assert resp.json()["id"] == MOCK_THREAD_ID

    def test_create_thread_merchant_not_found(self, client):
        """POST /chats — merchant SELECT returns []; 404."""
        mock_sb = _make_mock_sb()
        merchant_table = _make_mock_sb()
        merchant_table.select.return_value.eq.return_value.execute.return_value.data = []
        mock_sb.table.return_value = merchant_table

        with patch(PATCH_TARGET, return_value=mock_sb):
            resp = client.post(
                "/api/v1/chats",
                json={"merchant_id": "nonexistent-merchant"},
                headers=AUTH_HEADERS,
            )

        assert resp.status_code == 404
        assert "Merchant not found" in resp.json()["detail"]

    def test_create_thread_no_auth(self):
        """POST /chats — no auth headers; 422."""
        plain_client = TestClient(app)
        resp = plain_client.post("/api/v1/chats", json={"merchant_id": MOCK_MERCHANT_ID})
        assert resp.status_code == 422


# ---------------------------------------------------------------------------
# TestListMessages — GET /chats/{thread_id}/messages
# ---------------------------------------------------------------------------

class TestListMessages:
    def test_list_messages_success(self, client):
        """GET /chats/{tid}/messages — 200 with correct fields."""
        mock_sb = _make_mock_sb()
        thread_table = _make_eq_select_mock([{"id": MOCK_THREAD_ID}])
        msgs_table = _make_eq_eq_order_limit_mock([MOCK_MESSAGE_ROW])
        mock_sb.table.side_effect = [thread_table, msgs_table]

        with patch(PATCH_TARGET, return_value=mock_sb):
            resp = client.get(
                f"/api/v1/chats/{MOCK_THREAD_ID}/messages",
                headers=AUTH_HEADERS,
            )

        assert resp.status_code == 200
        body = resp.json()
        assert len(body["data"]) == 1
        msg = body["data"][0]
        assert msg["id"] == MOCK_MSG_ID
        assert msg["content"] == "Hello!"
        assert msg["sender_id"] == MOCK_USER_ID
        assert msg["read_by_user"] is True
        assert msg["read_by_merchant"] is False

    def test_list_messages_cursor_pagination(self, client):
        """GET /chats/{tid}/messages — limit+1 rows; has_more, next_cursor."""
        rows = [
            {**MOCK_MESSAGE_ROW, "id": f"msg-{i:03d}", "created_at": f"2024-06-01T1{i}:00:00+00:00"}
            for i in range(6)  # limit=5, +1 = 6 rows
        ]
        mock_sb = _make_mock_sb()
        thread_table = _make_eq_select_mock([{"id": MOCK_THREAD_ID}])
        msgs_table = _make_eq_eq_order_limit_mock(rows)
        mock_sb.table.side_effect = [thread_table, msgs_table]

        with patch(PATCH_TARGET, return_value=mock_sb):
            resp = client.get(
                f"/api/v1/chats/{MOCK_THREAD_ID}/messages?limit=5",
                headers=AUTH_HEADERS,
            )

        assert resp.status_code == 200
        body = resp.json()
        assert body["has_more"] is True
        assert body["next_cursor"] is not None
        assert len(body["data"]) == 5

    def test_list_messages_not_participant(self, client):
        """GET /chats/{tid}/messages — thread check returns []; 403."""
        mock_sb = _make_mock_sb()
        thread_table = _make_eq_select_mock([])
        mock_sb.table.return_value = thread_table

        with patch(PATCH_TARGET, return_value=mock_sb):
            resp = client.get(
                f"/api/v1/chats/{MOCK_THREAD_ID}/messages",
                headers=AUTH_HEADERS,
            )

        assert resp.status_code == 403

    def test_list_messages_empty_thread(self, client):
        """GET /chats/{tid}/messages — thread check OK, messages []; 200 empty."""
        mock_sb = _make_mock_sb()
        thread_table = _make_eq_select_mock([{"id": MOCK_THREAD_ID}])
        msgs_table = _make_eq_eq_order_limit_mock([])
        mock_sb.table.side_effect = [thread_table, msgs_table]

        with patch(PATCH_TARGET, return_value=mock_sb):
            resp = client.get(
                f"/api/v1/chats/{MOCK_THREAD_ID}/messages",
                headers=AUTH_HEADERS,
            )

        assert resp.status_code == 200
        body = resp.json()
        assert body["data"] == []
        assert body["has_more"] is False


# ---------------------------------------------------------------------------
# TestSendMessage — POST /chats/{thread_id}/messages
# ---------------------------------------------------------------------------

class TestSendMessage:
    def test_send_message_success(self, client):
        """POST /chats/{tid}/messages — INSERT succeeds; 201, content matches."""
        mock_sb = _make_mock_sb()
        thread_table = _make_eq_select_mock([{"id": MOCK_THREAD_ID}])
        insert_table = _make_insert_mock(MOCK_MESSAGE_ROW)
        mock_sb.table.side_effect = [thread_table, insert_table]

        with patch(PATCH_TARGET, return_value=mock_sb):
            resp = client.post(
                f"/api/v1/chats/{MOCK_THREAD_ID}/messages",
                json={"content": "Hello!"},
                headers=AUTH_HEADERS,
            )

        assert resp.status_code == 201
        body = resp.json()
        assert body["content"] == "Hello!"
        assert body["thread_id"] == MOCK_THREAD_ID

    def test_send_message_not_participant(self, client):
        """POST /chats/{tid}/messages — thread check returns []; 403."""
        mock_sb = _make_mock_sb()
        thread_table = _make_eq_select_mock([])
        mock_sb.table.return_value = thread_table

        with patch(PATCH_TARGET, return_value=mock_sb):
            resp = client.post(
                f"/api/v1/chats/{MOCK_THREAD_ID}/messages",
                json={"content": "Hello!"},
                headers=AUTH_HEADERS,
            )

        assert resp.status_code == 403

    def test_send_message_empty_content(self, client):
        """POST /chats/{tid}/messages — content=''; 422 (Pydantic min_length=1)."""
        resp = client.post(
            f"/api/v1/chats/{MOCK_THREAD_ID}/messages",
            json={"content": ""},
            headers=AUTH_HEADERS,
        )
        assert resp.status_code == 422

    def test_send_message_whitespace_only(self, client):
        """POST /chats/{tid}/messages — content='   ' rejected by field_validator → 422.

        Pydantic min_length=1 alone does NOT strip whitespace, so '   ' (len=3) would pass.
        The custom @field_validator('content') strips and checks — raises ValueError → 422.
        """
        resp = client.post(
            f"/api/v1/chats/{MOCK_THREAD_ID}/messages",
            json={"content": "   "},
            headers=AUTH_HEADERS,
        )
        # Custom validator rejects whitespace-only content before it reaches the handler
        assert resp.status_code == 422


# ---------------------------------------------------------------------------
# TestMarkRead — PATCH /chats/{thread_id}/read
# ---------------------------------------------------------------------------

class TestMarkRead:
    def _thread_with_merchant(self, merchant_owner_id=MERCHANT_OWNER_ID):
        return {
            "id": MOCK_THREAD_ID,
            "user_id": MOCK_USER_ID,
            "merchants": {"user_id": merchant_owner_id},
        }

    def test_mark_read_as_user(self, client):
        """PATCH /chats/{tid}/read — caller is thread.user_id; returns marked_read count."""
        updated_msgs = [MOCK_MESSAGE_ROW, {**MOCK_MESSAGE_ROW, "id": "msg-002"}]

        mock_sb = _make_mock_sb()
        # Call 1: fetch thread
        thread_table = _make_eq_select_mock([self._thread_with_merchant()])
        # Call 2: update messages read_by_user
        update_msgs_table = _make_update_eq_eq_mock(updated_msgs)
        # Call 3: reset unread counter on thread
        update_thread_table = _make_update_eq_mock()
        mock_sb.table.side_effect = [thread_table, update_msgs_table, update_thread_table]

        with patch(PATCH_TARGET, return_value=mock_sb):
            resp = client.patch(
                f"/api/v1/chats/{MOCK_THREAD_ID}/read",
                headers=AUTH_HEADERS,
            )

        assert resp.status_code == 200
        assert resp.json()["marked_read"] == 2

    def test_mark_read_as_merchant(self, client):
        """PATCH /chats/{tid}/read — caller is merchant owner; marks read_by_merchant."""
        from app.core.auth import get_current_user
        merchant_caller = {"id": MERCHANT_OWNER_ID, "email": "merchant@test.com", "token": "tok"}
        app.dependency_overrides[get_current_user] = lambda: merchant_caller

        updated_msgs = [MOCK_MESSAGE_ROW]
        mock_sb = _make_mock_sb()
        thread_table = _make_eq_select_mock([self._thread_with_merchant()])
        update_msgs_table = _make_update_eq_eq_mock(updated_msgs)
        update_thread_table = _make_update_eq_mock()
        mock_sb.table.side_effect = [thread_table, update_msgs_table, update_thread_table]

        with patch(PATCH_TARGET, return_value=mock_sb):
            resp = client.patch(
                f"/api/v1/chats/{MOCK_THREAD_ID}/read",
                headers=AUTH_HEADERS,
            )

        app.dependency_overrides.clear()
        app.dependency_overrides[get_current_user] = lambda: MOCK_USER

        assert resp.status_code == 200
        assert resp.json()["marked_read"] == 1

    def test_mark_read_not_participant(self, client):
        """PATCH /chats/{tid}/read — thread check returns []; 403."""
        mock_sb = _make_mock_sb()
        thread_table = _make_eq_select_mock([])
        mock_sb.table.return_value = thread_table

        with patch(PATCH_TARGET, return_value=mock_sb):
            resp = client.patch(
                f"/api/v1/chats/{MOCK_THREAD_ID}/read",
                headers=AUTH_HEADERS,
            )

        assert resp.status_code == 403

    def test_mark_read_zero_unread(self, client):
        """PATCH /chats/{tid}/read — 0 rows updated; marked_read: 0."""
        mock_sb = _make_mock_sb()
        thread_table = _make_eq_select_mock([self._thread_with_merchant()])
        update_msgs_table = _make_update_eq_eq_mock([])   # 0 messages updated
        update_thread_table = _make_update_eq_mock()
        mock_sb.table.side_effect = [thread_table, update_msgs_table, update_thread_table]

        with patch(PATCH_TARGET, return_value=mock_sb):
            resp = client.patch(
                f"/api/v1/chats/{MOCK_THREAD_ID}/read",
                headers=AUTH_HEADERS,
            )

        assert resp.status_code == 200
        assert resp.json()["marked_read"] == 0

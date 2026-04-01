"""
Unit tests for /api/v1/comments endpoints (S8-T1 — TDD red phase).

Supabase is fully mocked — no live instance required.
The `client` fixture (from conftest.py) overrides `get_current_user` with MOCK_USER.
Each test patches `app.api.v1.comments.get_user_supabase` to control DB responses.

NOTE: app/api/v1/comments.py does NOT exist yet — all tests will FAIL (red phase).
"""
from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient

from app.main import app
from tests.conftest import AUTH_HEADERS, MOCK_USER

# ---------------------------------------------------------------------------
# Test data constants
# ---------------------------------------------------------------------------

MOCK_POST_ID = "cccccccc-0000-0000-0000-000000000001"
MOCK_COMMENT_ID = "dddddddd-0000-0000-0000-000000000002"

# MOCK_USER["id"] is "user-123" — not a UUID.
# Use a proper UUID for user stubs in CommentResponse so schema validation passes.
MOCK_USER_UUID = "00000000-0000-0000-0000-000000000003"

MOCK_COMMENT_ROW = {
    "id": MOCK_COMMENT_ID,
    "post_id": MOCK_POST_ID,
    "user_id": MOCK_USER_UUID,
    "content": "Looks great!",
    "created_at": "2024-03-01T12:00:00Z",
    "profiles": {
        "id": MOCK_USER_UUID,
        "full_name": "Test User",
        "avatar_url": None,
    },
}


# ---------------------------------------------------------------------------
# Mock-builder helpers
# ---------------------------------------------------------------------------

def _make_mock_sb():
    return MagicMock()


def _make_list_table_mock(rows, count):
    """Build a table mock for the comments SELECT list chain.

    Chain: table().select().eq().order().limit().offset().execute()
    """
    mock = MagicMock()
    execute_result = MagicMock()
    execute_result.data = rows
    execute_result.count = count
    (
        mock.select.return_value
        .eq.return_value
        .order.return_value
        .limit.return_value
        .offset.return_value
        .execute.return_value
    ) = execute_result
    return mock


def _make_insert_sb_mock(insert_row, fetch_row):
    """Build a mock_sb for create_comment: insert table + re-fetch table.

    Chain 1 (insert): table().insert().execute()
    Chain 2 (fetch):  table().select().eq().single().execute()
    """
    insert_table = MagicMock()
    insert_execute = MagicMock()
    insert_execute.data = [insert_row]
    insert_table.insert.return_value.execute.return_value = insert_execute

    fetch_table = MagicMock()
    fetch_execute = MagicMock()
    fetch_execute.data = fetch_row
    (
        fetch_table.select.return_value
        .eq.return_value
        .single.return_value
        .execute.return_value
    ) = fetch_execute

    mock_sb = _make_mock_sb()
    mock_sb.table.side_effect = [insert_table, fetch_table]
    return mock_sb


# ---------------------------------------------------------------------------
# TestListComments — GET /posts/{post_id}/comments
# ---------------------------------------------------------------------------

class TestListComments:
    def test_list_comments_200(self, client):
        """GET /posts/{post_id}/comments — returns 200 + CommentListResponse."""
        mock_sb = _make_mock_sb()
        mock_sb.table.return_value = _make_list_table_mock([MOCK_COMMENT_ROW], 1)

        with patch("app.api.v1.comments.get_user_supabase", return_value=mock_sb):
            resp = client.get(
                f"/api/v1/posts/{MOCK_POST_ID}/comments",
                headers=AUTH_HEADERS,
            )

        assert resp.status_code == 200
        body = resp.json()
        assert body["count"] == 1
        assert len(body["data"]) == 1
        comment = body["data"][0]
        assert comment["content"] == "Looks great!"
        assert comment["user"]["full_name"] == "Test User"

    def test_list_comments_empty(self, client):
        """GET /posts/{post_id}/comments — returns empty list when no comments."""
        mock_sb = _make_mock_sb()
        mock_sb.table.return_value = _make_list_table_mock([], 0)

        with patch("app.api.v1.comments.get_user_supabase", return_value=mock_sb):
            resp = client.get(
                f"/api/v1/posts/{MOCK_POST_ID}/comments",
                headers=AUTH_HEADERS,
            )

        assert resp.status_code == 200
        body = resp.json()
        assert body["count"] == 0
        assert body["data"] == []

    def test_list_comments_pagination_params(self, client):
        """GET /posts/{post_id}/comments with limit/offset — params accepted."""
        mock_sb = _make_mock_sb()
        mock_sb.table.return_value = _make_list_table_mock([], 0)

        with patch("app.api.v1.comments.get_user_supabase", return_value=mock_sb):
            resp = client.get(
                f"/api/v1/posts/{MOCK_POST_ID}/comments",
                params={"limit": 5, "offset": 10},
                headers=AUTH_HEADERS,
            )

        assert resp.status_code == 200
        body = resp.json()
        assert "data" in body
        assert "count" in body


# ---------------------------------------------------------------------------
# TestCreateComment — POST /posts/{post_id}/comments
# ---------------------------------------------------------------------------

class TestCreateComment:
    def _base_insert_row(self, content="Looks great!"):
        return {
            "id": MOCK_COMMENT_ID,
            "post_id": MOCK_POST_ID,
            "user_id": MOCK_USER_UUID,
            "content": content,
            "created_at": "2024-03-01T12:00:00Z",
        }

    def _base_fetch_row(self, content="Looks great!"):
        return {
            **self._base_insert_row(content),
            "profiles": {
                "id": MOCK_USER_UUID,
                "full_name": "Test User",
                "avatar_url": None,
            },
        }

    def test_create_comment_201(self, client):
        """POST /posts/{post_id}/comments — success returns 201 + CommentResponse."""
        mock_sb = _make_insert_sb_mock(
            insert_row=self._base_insert_row(),
            fetch_row=self._base_fetch_row(),
        )

        with patch("app.api.v1.comments.get_user_supabase", return_value=mock_sb):
            resp = client.post(
                f"/api/v1/posts/{MOCK_POST_ID}/comments",
                json={"content": "Looks great!"},
                headers=AUTH_HEADERS,
            )

        assert resp.status_code == 201
        data = resp.json()
        assert data["content"] == "Looks great!"
        assert data["post_id"] == MOCK_POST_ID

    def test_create_comment_422_empty_content(self, client):
        """POST /posts/{post_id}/comments with empty string — Pydantic returns 422."""
        resp = client.post(
            f"/api/v1/posts/{MOCK_POST_ID}/comments",
            json={"content": ""},
            headers=AUTH_HEADERS,
        )
        assert resp.status_code == 422

    def test_create_comment_422_missing_content(self, client):
        """POST /posts/{post_id}/comments with no content field — returns 422."""
        resp = client.post(
            f"/api/v1/posts/{MOCK_POST_ID}/comments",
            json={},
            headers=AUTH_HEADERS,
        )
        assert resp.status_code == 422

    def test_create_comment_401_unauthenticated(self):
        """POST /posts/{post_id}/comments with invalid token — returns 401.

        get_current_user raises 401 when token is unrecognized.
        A garbage Bearer token (not overridden by fixture) triggers the real dep.
        """
        raw_client = TestClient(app, raise_server_exceptions=False)
        resp = raw_client.post(
            f"/api/v1/posts/{MOCK_POST_ID}/comments",
            json={"content": "Looks great!"},
            headers={"Authorization": "Bearer invalid-garbage-token"},
        )
        assert resp.status_code == 401


# ---------------------------------------------------------------------------
# TestUpdateComment — PATCH /posts/{post_id}/comments/{comment_id}
# ---------------------------------------------------------------------------

class TestUpdateComment:
    def test_update_comment_200(self, client):
        """PATCH own comment — returns 200 + updated CommentResponse."""
        updated_row = {**MOCK_COMMENT_ROW, "content": "Updated text"}

        update_table = MagicMock()
        update_execute = MagicMock()
        update_execute.data = [updated_row]
        (
            update_table.update.return_value
            .eq.return_value
            .eq.return_value
            .eq.return_value
            .execute.return_value
        ) = update_execute

        fetch_table = MagicMock()
        fetch_execute = MagicMock()
        fetch_execute.data = updated_row
        (
            fetch_table.select.return_value
            .eq.return_value
            .single.return_value
            .execute.return_value
        ) = fetch_execute

        mock_sb = _make_mock_sb()
        mock_sb.table.side_effect = [update_table, fetch_table]

        with patch("app.api.v1.comments.get_user_supabase", return_value=mock_sb):
            resp = client.patch(
                f"/api/v1/posts/{MOCK_POST_ID}/comments/{MOCK_COMMENT_ID}",
                json={"content": "Updated text"},
                headers=AUTH_HEADERS,
            )

        assert resp.status_code == 200
        data = resp.json()
        assert data["content"] == "Updated text"

    def test_update_comment_403_not_owner(self, client):
        """PATCH another user's comment — returns 403.

        The update query filters by user_id == caller's id.
        An empty data[] response means the row was not owned by caller.
        """
        mock_sb = _make_mock_sb()
        update_execute = MagicMock()
        update_execute.data = []
        (
            mock_sb.table.return_value
            .update.return_value
            .eq.return_value
            .eq.return_value
            .eq.return_value
            .execute.return_value
        ) = update_execute

        with patch("app.api.v1.comments.get_user_supabase", return_value=mock_sb):
            resp = client.patch(
                f"/api/v1/posts/{MOCK_POST_ID}/comments/{MOCK_COMMENT_ID}",
                json={"content": "Hijacked text"},
                headers=AUTH_HEADERS,
            )

        assert resp.status_code == 403


# ---------------------------------------------------------------------------
# TestDeleteComment — DELETE /posts/{post_id}/comments/{comment_id}
# ---------------------------------------------------------------------------

class TestDeleteComment:
    def test_delete_comment_204(self, client):
        """DELETE own comment — returns 204 with no body."""
        mock_sb = _make_mock_sb()
        delete_execute = MagicMock()
        delete_execute.data = [MOCK_COMMENT_ROW]
        (
            mock_sb.table.return_value
            .delete.return_value
            .eq.return_value
            .eq.return_value
            .eq.return_value
            .execute.return_value
        ) = delete_execute

        with patch("app.api.v1.comments.get_user_supabase", return_value=mock_sb):
            resp = client.delete(
                f"/api/v1/posts/{MOCK_POST_ID}/comments/{MOCK_COMMENT_ID}",
                headers=AUTH_HEADERS,
            )

        assert resp.status_code == 204

    def test_delete_comment_403_not_owner(self, client):
        """DELETE another user's comment — returns 403.

        The delete query filters by user_id == caller's id.
        An empty data[] response means the row was not owned by caller.
        """
        mock_sb = _make_mock_sb()
        delete_execute = MagicMock()
        delete_execute.data = []
        (
            mock_sb.table.return_value
            .delete.return_value
            .eq.return_value
            .eq.return_value
            .eq.return_value
            .execute.return_value
        ) = delete_execute

        with patch("app.api.v1.comments.get_user_supabase", return_value=mock_sb):
            resp = client.delete(
                f"/api/v1/posts/{MOCK_POST_ID}/comments/{MOCK_COMMENT_ID}",
                headers=AUTH_HEADERS,
            )

        assert resp.status_code == 403

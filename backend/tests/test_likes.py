"""
Unit tests for /api/v1/likes endpoints (S8-T1 / S8-B5).

Supabase is fully mocked — no live instance required.
The `client` fixture (from conftest.py) overrides `get_current_user` with MOCK_USER.
Each test patches `app.api.v1.likes.get_user_supabase` to control DB responses.

Routes tested:
  POST   /posts/{post_id}/like  — 201 {liked: true}; 409 duplicate; 401 unauthenticated
  DELETE /posts/{post_id}/like  — 204 on success;    404 not liked;  401 unauthenticated

NOTE: app/api/v1/likes.py does NOT exist yet.
      These tests are expected to FAIL (TDD red phase).
"""
from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient

from app.main import app
from tests.conftest import AUTH_HEADERS, MOCK_USER

# ---------------------------------------------------------------------------
# Test data
# ---------------------------------------------------------------------------

# Use proper UUIDs for post_id and user_id
MOCK_POST_ID = "cccccccc-0000-0000-0000-000000000001"
MOCK_USER_ID = MOCK_USER["id"]  # "user-123" from conftest

MOCK_LIKE_ROW = {
    "post_id": MOCK_POST_ID,
    "user_id": MOCK_USER_ID,
}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_mock_sb():
    return MagicMock()


def _make_insert_sb_mock(row: dict):
    """Build a mock_sb where table().insert().execute() returns one row."""
    mock_sb = _make_mock_sb()
    execute_result = MagicMock()
    execute_result.data = [row]
    mock_sb.table.return_value.insert.return_value.execute.return_value = execute_result
    return mock_sb


def _make_delete_sb_mock(deleted_rows: list):
    """Build a mock_sb where the DELETE chain returns deleted_rows."""
    mock_sb = _make_mock_sb()
    execute_result = MagicMock()
    execute_result.data = deleted_rows
    (
        mock_sb.table.return_value
        .delete.return_value
        .eq.return_value
        .eq.return_value
        .execute.return_value
    ) = execute_result
    return mock_sb


# ---------------------------------------------------------------------------
# POST /posts/{post_id}/like
# ---------------------------------------------------------------------------

class TestLikePost:
    def test_like_post_201(self, client):
        """POST /posts/{id}/like — success returns 201 with {liked: true}."""
        mock_sb = _make_insert_sb_mock(MOCK_LIKE_ROW)

        with patch("app.api.v1.likes.get_user_supabase", return_value=mock_sb):
            resp = client.post(
                f"/api/v1/posts/{MOCK_POST_ID}/like",
                headers=AUTH_HEADERS,
            )

        assert resp.status_code == 201
        body = resp.json()
        assert body["liked"] is True

    def test_like_post_409_already_liked(self, client):
        """POST /posts/{id}/like twice — returns 409 duplicate."""
        mock_sb = _make_mock_sb()
        mock_sb.table.return_value.insert.return_value.execute.side_effect = Exception(
            "duplicate key violates unique constraint"
        )

        with patch("app.api.v1.likes.get_user_supabase", return_value=mock_sb):
            resp = client.post(
                f"/api/v1/posts/{MOCK_POST_ID}/like",
                headers=AUTH_HEADERS,
            )

        assert resp.status_code == 409
        assert "already" in resp.json()["detail"].lower()

    def test_like_post_401_unauthenticated(self):
        """POST /posts/{id}/like with invalid token — returns 401."""
        raw_client = TestClient(app, raise_server_exceptions=False)
        resp = raw_client.post(
            f"/api/v1/posts/{MOCK_POST_ID}/like",
            headers={"Authorization": "Bearer invalid-garbage-token"},
        )
        assert resp.status_code == 401


# ---------------------------------------------------------------------------
# DELETE /posts/{post_id}/like
# ---------------------------------------------------------------------------

class TestUnlikePost:
    def test_unlike_post_204(self, client):
        """DELETE /posts/{id}/like — success returns 204 no content."""
        mock_sb = _make_delete_sb_mock([MOCK_LIKE_ROW])

        with patch("app.api.v1.likes.get_user_supabase", return_value=mock_sb):
            resp = client.delete(
                f"/api/v1/posts/{MOCK_POST_ID}/like",
                headers=AUTH_HEADERS,
            )

        assert resp.status_code == 204
        assert resp.content == b""

    def test_unlike_post_404_not_liked(self, client):
        """DELETE /posts/{id}/like when not liked — returns 404."""
        mock_sb = _make_delete_sb_mock([])  # no rows deleted

        with patch("app.api.v1.likes.get_user_supabase", return_value=mock_sb):
            resp = client.delete(
                f"/api/v1/posts/{MOCK_POST_ID}/like",
                headers=AUTH_HEADERS,
            )

        assert resp.status_code == 404

    def test_unlike_post_401_unauthenticated(self):
        """DELETE /posts/{id}/like with invalid token — returns 401."""
        raw_client = TestClient(app, raise_server_exceptions=False)
        resp = raw_client.delete(
            f"/api/v1/posts/{MOCK_POST_ID}/like",
            headers={"Authorization": "Bearer invalid-garbage-token"},
        )
        assert resp.status_code == 401

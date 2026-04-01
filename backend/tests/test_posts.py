"""
Unit tests for /api/v1/merchants/{merchant_id}/posts endpoints (S8-T1).

Supabase is fully mocked — no live instance required.
The `client` fixture (from conftest.py) overrides `get_current_user` with MOCK_USER.
Each test patches `app.api.v1.posts.get_user_supabase` to control DB responses.

TDD RED PHASE: app/api/v1/posts.py does not exist yet.
Tests will fail with ModuleNotFoundError or 404 until implementation is complete.
"""
from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient

from app.main import app
from tests.conftest import AUTH_HEADERS, MOCK_USER

# ---------------------------------------------------------------------------
# Test constants — valid UUIDs required by PostResponse / MerchantStub schemas
# ---------------------------------------------------------------------------

MOCK_MERCHANT_ID = "aaaaaaaa-0000-0000-0000-000000000001"
MOCK_POST_ID = "bbbbbbbb-0000-0000-0000-000000000002"
# MOCK_USER["id"] is "user-123" (not a UUID); use a proper UUID where required
MOCK_USER_UUID = "00000000-0000-0000-0000-000000000003"

MOCK_MERCHANT_STUB = {
    "id": MOCK_MERCHANT_ID,
    "name": "Test Merchant",
    "avatar_url": None,
}

MOCK_POST_ROW = {
    "id": MOCK_POST_ID,
    "merchant_id": MOCK_MERCHANT_ID,
    "content": "Special 20% off today!",
    "post_type": "offer",
    "image_url": None,
    "like_count": 0,
    "comment_count": 0,
    "is_liked_by_me": False,
    "created_at": "2024-03-01T10:00:00Z",
    "merchants": MOCK_MERCHANT_STUB,
}

PATCH_TARGET = "app.api.v1.posts.get_user_supabase"


# ---------------------------------------------------------------------------
# Mock builder helpers
# ---------------------------------------------------------------------------

def _make_mock_sb():
    return MagicMock()


def _make_posts_select_mock(rows, count):
    """Build a posts SELECT chain mock: select().eq().order().limit().execute()"""
    mock = MagicMock()
    execute_result = MagicMock()
    execute_result.data = rows
    execute_result.count = count
    (
        mock.select.return_value
        .eq.return_value
        .order.return_value
        .limit.return_value
        .execute.return_value
    ) = execute_result
    return mock


def _make_posts_select_with_offset_mock(rows, count):
    """Build a posts SELECT chain with limit+offset: select().eq().order().limit().offset().execute()"""
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


def _make_merchant_exists_mock(exists=True):
    """Build a merchants SELECT single mock for merchant existence check."""
    mock = MagicMock()
    execute_result = MagicMock()
    execute_result.data = {"id": MOCK_MERCHANT_ID} if exists else None
    (
        mock.select.return_value
        .eq.return_value
        .single.return_value
        .execute.return_value
    ) = execute_result
    return mock


def _make_likes_select_mock(liked_post_ids):
    """Build a likes SELECT mock for is_liked_by_me resolution."""
    mock = MagicMock()
    execute_result = MagicMock()
    execute_result.data = [{"post_id": pid} for pid in liked_post_ids]
    (
        mock.select.return_value
        .eq.return_value
        .in_.return_value
        .execute.return_value
    ) = execute_result
    return mock


def _make_insert_mock(row):
    """Build a table mock for INSERT returning a single row."""
    mock = MagicMock()
    execute_result = MagicMock()
    execute_result.data = [row]
    mock.insert.return_value.execute.return_value = execute_result
    return mock


def _make_update_mock(rows):
    """Build a table mock for UPDATE chain: update().eq().eq().execute()"""
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


def _make_fetch_single_mock(row):
    """Build a SELECT single fetch mock used after insert/update."""
    mock = MagicMock()
    execute_result = MagicMock()
    execute_result.data = row
    (
        mock.select.return_value
        .eq.return_value
        .single.return_value
        .execute.return_value
    ) = execute_result
    return mock


def _make_soft_delete_mock(rows):
    """Build a table mock for soft-delete UPDATE chain."""
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


# ---------------------------------------------------------------------------
# TestListPosts — GET /merchants/{merchant_id}/posts
# ---------------------------------------------------------------------------

class TestListPosts:
    def test_list_posts_200_returns_post_list_response(self, client):
        """GET /merchants/{id}/posts — 200 with data[] and count."""
        mock_sb = _make_mock_sb()
        mock_sb.table.side_effect = [
            _make_merchant_exists_mock(exists=True),
            _make_posts_select_mock([MOCK_POST_ROW], 1),
            _make_likes_select_mock([]),
        ]

        with patch(PATCH_TARGET, return_value=mock_sb):
            resp = client.get(
                f"/api/v1/merchants/{MOCK_MERCHANT_ID}/posts",
                headers=AUTH_HEADERS,
            )

        assert resp.status_code == 200
        body = resp.json()
        assert "data" in body
        assert "count" in body
        assert body["count"] == 1
        assert len(body["data"]) == 1
        post = body["data"][0]
        assert post["content"] == "Special 20% off today!"
        assert post["post_type"] == "offer"
        assert "merchant" in post
        assert post["merchant"]["name"] == "Test Merchant"

    def test_list_posts_200_unauthenticated_is_liked_by_me_false(self):
        """GET /merchants/{id}/posts — unauthenticated caller gets is_liked_by_me=false."""
        # Unauthenticated: no AUTH_HEADERS, get_current_user returns None/anonymous
        # Route must not crash and must return is_liked_by_me=false for all posts
        mock_sb = _make_mock_sb()
        mock_sb.table.side_effect = [
            _make_merchant_exists_mock(exists=True),
            _make_posts_select_mock([MOCK_POST_ROW], 1),
        ]

        raw_client = TestClient(app, raise_server_exceptions=False)
        with patch(PATCH_TARGET, return_value=mock_sb):
            resp = raw_client.get(
                f"/api/v1/merchants/{MOCK_MERCHANT_ID}/posts",
            )

        # Route must return 200 (no auth required for listing posts)
        assert resp.status_code == 200
        body = resp.json()
        assert len(body["data"]) == 1
        assert body["data"][0]["is_liked_by_me"] is False

    def test_list_posts_404_merchant_not_found(self, client):
        """GET /merchants/{id}/posts — 404 if merchant does not exist."""
        mock_sb = _make_mock_sb()
        mock_sb.table.side_effect = [
            _make_merchant_exists_mock(exists=False),
        ]

        with patch(PATCH_TARGET, return_value=mock_sb):
            resp = client.get(
                f"/api/v1/merchants/{MOCK_MERCHANT_ID}/posts",
                headers=AUTH_HEADERS,
            )

        assert resp.status_code == 404

    def test_list_posts_200_is_liked_by_me_true_for_liked_post(self, client):
        """GET /merchants/{id}/posts — is_liked_by_me=true when caller liked the post."""
        mock_sb = _make_mock_sb()
        mock_sb.table.side_effect = [
            _make_merchant_exists_mock(exists=True),
            _make_posts_select_mock([MOCK_POST_ROW], 1),
            _make_likes_select_mock([MOCK_POST_ID]),
        ]

        with patch(PATCH_TARGET, return_value=mock_sb):
            resp = client.get(
                f"/api/v1/merchants/{MOCK_MERCHANT_ID}/posts",
                headers=AUTH_HEADERS,
            )

        assert resp.status_code == 200
        assert resp.json()["data"][0]["is_liked_by_me"] is True

    def test_list_posts_200_empty_list(self, client):
        """GET /merchants/{id}/posts — returns empty data[] when no posts."""
        mock_sb = _make_mock_sb()
        mock_sb.table.side_effect = [
            _make_merchant_exists_mock(exists=True),
            _make_posts_select_mock([], 0),
        ]

        with patch(PATCH_TARGET, return_value=mock_sb):
            resp = client.get(
                f"/api/v1/merchants/{MOCK_MERCHANT_ID}/posts",
                headers=AUTH_HEADERS,
            )

        assert resp.status_code == 200
        body = resp.json()
        assert body["count"] == 0
        assert body["data"] == []


# ---------------------------------------------------------------------------
# TestCreatePost — POST /merchants/{merchant_id}/posts
# ---------------------------------------------------------------------------

class TestCreatePost:
    def _post_row(self, content="Special 20% off today!", post_type="offer"):
        return {
            **MOCK_POST_ROW,
            "content": content,
            "post_type": post_type,
        }

    def test_create_post_201(self, client):
        """POST /merchants/{id}/posts — 201 with PostResponse."""
        insert_row = self._post_row()
        fetch_row = {**insert_row, "merchants": MOCK_MERCHANT_STUB}

        mock_sb = _make_mock_sb()
        insert_table = _make_insert_mock(insert_row)
        fetch_table = _make_fetch_single_mock(fetch_row)
        mock_sb.table.side_effect = [insert_table, fetch_table]

        with patch(PATCH_TARGET, return_value=mock_sb):
            resp = client.post(
                f"/api/v1/merchants/{MOCK_MERCHANT_ID}/posts",
                json={"content": "Special 20% off today!", "post_type": "offer"},
                headers=AUTH_HEADERS,
            )

        assert resp.status_code == 201
        data = resp.json()
        assert data["content"] == "Special 20% off today!"
        assert data["post_type"] == "offer"
        assert data["merchant_id"] == MOCK_MERCHANT_ID

    def test_create_post_201_update_type(self, client):
        """POST /merchants/{id}/posts with post_type=update — 201."""
        insert_row = self._post_row(content="We're open on Sunday!", post_type="update")
        fetch_row = {**insert_row, "merchants": MOCK_MERCHANT_STUB}

        mock_sb = _make_mock_sb()
        insert_table = _make_insert_mock(insert_row)
        fetch_table = _make_fetch_single_mock(fetch_row)
        mock_sb.table.side_effect = [insert_table, fetch_table]

        with patch(PATCH_TARGET, return_value=mock_sb):
            resp = client.post(
                f"/api/v1/merchants/{MOCK_MERCHANT_ID}/posts",
                json={"content": "We're open on Sunday!", "post_type": "update"},
                headers=AUTH_HEADERS,
            )

        assert resp.status_code == 201
        assert resp.json()["post_type"] == "update"

    def test_create_post_403_not_owner(self, client):
        """POST /merchants/{id}/posts — 403 when caller is not merchant owner (RLS)."""
        mock_sb = _make_mock_sb()
        mock_sb.table.return_value.insert.return_value.execute.side_effect = Exception(
            "violates row-level security policy"
        )

        with patch(PATCH_TARGET, return_value=mock_sb):
            resp = client.post(
                f"/api/v1/merchants/{MOCK_MERCHANT_ID}/posts",
                json={"content": "Unauthorised post", "post_type": "offer"},
                headers=AUTH_HEADERS,
            )

        assert resp.status_code == 403

    def test_create_post_422_empty_content(self, client):
        """POST /merchants/{id}/posts — 422 when content is empty string."""
        resp = client.post(
            f"/api/v1/merchants/{MOCK_MERCHANT_ID}/posts",
            json={"content": "", "post_type": "offer"},
            headers=AUTH_HEADERS,
        )
        assert resp.status_code == 422

    def test_create_post_422_missing_content(self, client):
        """POST /merchants/{id}/posts — 422 when content field is absent."""
        resp = client.post(
            f"/api/v1/merchants/{MOCK_MERCHANT_ID}/posts",
            json={"post_type": "offer"},
            headers=AUTH_HEADERS,
        )
        assert resp.status_code == 422

    def test_create_post_422_invalid_post_type(self, client):
        """POST /merchants/{id}/posts — 422 when post_type is not offer or update."""
        resp = client.post(
            f"/api/v1/merchants/{MOCK_MERCHANT_ID}/posts",
            json={"content": "Hello", "post_type": "advertisement"},
            headers=AUTH_HEADERS,
        )
        assert resp.status_code == 422

    def test_create_post_422_content_exceeds_500_chars(self, client):
        """POST /merchants/{id}/posts — 422 when content exceeds 500 chars."""
        long_content = "x" * 501
        resp = client.post(
            f"/api/v1/merchants/{MOCK_MERCHANT_ID}/posts",
            json={"content": long_content, "post_type": "update"},
            headers=AUTH_HEADERS,
        )
        assert resp.status_code == 422

    def test_create_post_200_content_at_500_chars_boundary(self, client):
        """POST /merchants/{id}/posts — exactly 500 chars is valid."""
        content_500 = "x" * 500
        insert_row = self._post_row(content=content_500)
        fetch_row = {**insert_row, "merchants": MOCK_MERCHANT_STUB}

        mock_sb = _make_mock_sb()
        insert_table = _make_insert_mock(insert_row)
        fetch_table = _make_fetch_single_mock(fetch_row)
        mock_sb.table.side_effect = [insert_table, fetch_table]

        with patch(PATCH_TARGET, return_value=mock_sb):
            resp = client.post(
                f"/api/v1/merchants/{MOCK_MERCHANT_ID}/posts",
                json={"content": content_500, "post_type": "offer"},
                headers=AUTH_HEADERS,
            )

        assert resp.status_code == 201


# ---------------------------------------------------------------------------
# TestUpdatePost — PATCH /merchants/{merchant_id}/posts/{post_id}
# ---------------------------------------------------------------------------

class TestUpdatePost:
    def test_update_post_200_updates_content(self, client):
        """PATCH /merchants/{id}/posts/{pid} — 200 with updated content."""
        updated_row = {**MOCK_POST_ROW, "content": "Updated content here"}
        fetch_row = {**updated_row, "merchants": MOCK_MERCHANT_STUB}

        update_table = _make_update_mock([updated_row])
        fetch_table = _make_fetch_single_mock(fetch_row)

        mock_sb = _make_mock_sb()
        mock_sb.table.side_effect = [update_table, fetch_table]

        with patch(PATCH_TARGET, return_value=mock_sb):
            resp = client.patch(
                f"/api/v1/merchants/{MOCK_MERCHANT_ID}/posts/{MOCK_POST_ID}",
                json={"content": "Updated content here"},
                headers=AUTH_HEADERS,
            )

        assert resp.status_code == 200
        data = resp.json()
        assert data["content"] == "Updated content here"

    def test_update_post_403_non_owner(self, client):
        """PATCH /merchants/{id}/posts/{pid} — 403 when caller is not the owner."""
        mock_sb = _make_mock_sb()
        update_execute = MagicMock()
        update_execute.data = []
        (
            mock_sb.table.return_value
            .update.return_value
            .eq.return_value
            .eq.return_value
            .execute.return_value
        ) = update_execute

        with patch(PATCH_TARGET, return_value=mock_sb):
            resp = client.patch(
                f"/api/v1/merchants/{MOCK_MERCHANT_ID}/posts/{MOCK_POST_ID}",
                json={"content": "Trying to hijack"},
                headers=AUTH_HEADERS,
            )

        assert resp.status_code == 403


# ---------------------------------------------------------------------------
# TestDeletePost — DELETE /merchants/{merchant_id}/posts/{post_id}
# ---------------------------------------------------------------------------

class TestDeletePost:
    def test_delete_post_204_soft_delete(self, client):
        """DELETE /merchants/{id}/posts/{pid} — 204; post is soft-deleted (is_active=false)."""
        soft_deleted_row = {**MOCK_POST_ROW, "is_active": False}

        mock_sb = _make_mock_sb()
        mock_sb.table.side_effect = [
            _make_soft_delete_mock([soft_deleted_row]),
        ]

        with patch(PATCH_TARGET, return_value=mock_sb):
            resp = client.delete(
                f"/api/v1/merchants/{MOCK_MERCHANT_ID}/posts/{MOCK_POST_ID}",
                headers=AUTH_HEADERS,
            )

        assert resp.status_code == 204

    def test_delete_post_403_non_owner(self, client):
        """DELETE /merchants/{id}/posts/{pid} — 403 when caller is not the owner."""
        mock_sb = _make_mock_sb()
        soft_delete_execute = MagicMock()
        soft_delete_execute.data = []
        (
            mock_sb.table.return_value
            .update.return_value
            .eq.return_value
            .eq.return_value
            .execute.return_value
        ) = soft_delete_execute

        with patch(PATCH_TARGET, return_value=mock_sb):
            resp = client.delete(
                f"/api/v1/merchants/{MOCK_MERCHANT_ID}/posts/{MOCK_POST_ID}",
                headers=AUTH_HEADERS,
            )

        assert resp.status_code == 403

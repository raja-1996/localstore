"""
Unit tests for post creation -> push notification integration (Sprint 11, S11-T3).

Verifies that POST /merchants/{id}/posts triggers push_tasks.send_post_push
via BackgroundTasks. Supabase is fully mocked — no live instance required.
"""
from unittest.mock import AsyncMock, MagicMock, patch

from tests.conftest import AUTH_HEADERS, MOCK_USER

PATCH_SB = "app.api.v1.posts.get_user_supabase"
PATCH_PUSH = "app.api.v1.posts.push_tasks"

MOCK_USER_ID = MOCK_USER["id"]
MOCK_MERCHANT_ID = "00000000-0000-0000-0000-000000000001"
MOCK_POST_ID = "00000000-0000-0000-0000-000000000002"

MOCK_POST_ROW = {
    "id": MOCK_POST_ID,
    "merchant_id": MOCK_MERCHANT_ID,
    "content": "Fresh deals today!",
    "post_type": "offer",
    "image_url": None,
    "like_count": 0,
    "comment_count": 0,
    "created_at": "2024-06-01T12:00:00+00:00",
    "merchants": {"id": MOCK_MERCHANT_ID, "name": "Test Shop"},
}


def _make_mock_sb_for_create(post_row=None):
    """Build a mock Supabase client that supports insert + re-fetch for create_post."""
    row = post_row or MOCK_POST_ROW
    mock_sb = MagicMock()

    # First .table("posts") call — insert
    insert_exec = MagicMock()
    insert_exec.data = [row]

    # Second .table("posts") call — re-fetch with joined merchant
    fetch_exec = MagicMock()
    fetch_exec.data = row

    insert_table = MagicMock()
    insert_table.insert.return_value.execute.return_value = insert_exec

    fetch_table = MagicMock()
    fetch_table.select.return_value.eq.return_value.single.return_value.execute.return_value = fetch_exec

    mock_sb.table.side_effect = [insert_table, fetch_table]
    return mock_sb


class TestPostCreationPush:
    """POST /merchants/{id}/posts -> push_tasks.send_post_push integration."""

    def test_create_post_triggers_follower_push(self, client):
        """Successful post creation schedules send_post_push via BackgroundTasks."""
        mock_sb = _make_mock_sb_for_create()
        mock_push = MagicMock()
        # Use AsyncMock so the background task runner can await it
        mock_push.send_post_push = AsyncMock()

        with patch(PATCH_SB, return_value=mock_sb), patch(PATCH_PUSH, mock_push):
            resp = client.post(
                f"/api/v1/merchants/{MOCK_MERCHANT_ID}/posts",
                json={"content": "Fresh deals today!", "post_type": "offer"},
                headers=AUTH_HEADERS,
            )

        assert resp.status_code == 201
        # FastAPI TestClient runs background tasks synchronously after response.
        # send_post_push should have been called once with the correct args.
        mock_push.send_post_push.assert_called_once_with(
            merchant_id=MOCK_MERCHANT_ID,
            merchant_name="Test Shop",
            post_preview="Fresh deals today!",
        )

    def test_create_post_no_merchant_name_no_push(self, client):
        """When merchant name is empty, push is NOT scheduled."""
        row_no_name = {**MOCK_POST_ROW, "merchants": {"id": MOCK_MERCHANT_ID, "name": ""}}
        mock_sb = _make_mock_sb_for_create(row_no_name)
        mock_push = MagicMock()

        with patch(PATCH_SB, return_value=mock_sb), patch(PATCH_PUSH, mock_push):
            resp = client.post(
                f"/api/v1/merchants/{MOCK_MERCHANT_ID}/posts",
                json={"content": "Hello", "post_type": "offer"},
                headers=AUTH_HEADERS,
            )

        assert resp.status_code == 201
        # send_post_push should not be called when merchant_name is empty
        mock_push.send_post_push.assert_not_called()

    def test_create_post_push_failure_does_not_affect_response(self, client):
        """Push service failure is silently swallowed; route still returns 201."""
        mock_sb = _make_mock_sb_for_create()

        # Patch deeper: push_service.send_bulk_push raises inside the background task.
        # push_tasks.send_post_push has try/except, so the exception is swallowed.
        mock_supabase = MagicMock()
        mock_supabase.table.return_value.select.return_value.eq.return_value.execute.return_value.data = []

        with (
            patch(PATCH_SB, return_value=mock_sb),
            patch("app.background.push_tasks.get_supabase", return_value=mock_supabase),
            patch(
                "app.services.push_service.send_bulk_push",
                new_callable=AsyncMock,
                side_effect=Exception("Expo API down"),
            ),
        ):
            resp = client.post(
                f"/api/v1/merchants/{MOCK_MERCHANT_ID}/posts",
                json={"content": "Fresh deals today!", "post_type": "offer"},
                headers=AUTH_HEADERS,
            )

        # Route still returns 201 regardless of push failure
        assert resp.status_code == 201
        data = resp.json()
        assert data["id"] == MOCK_POST_ID

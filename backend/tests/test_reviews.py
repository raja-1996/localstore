"""
Unit tests for /api/v1/reviews endpoints (S7-T1).

Supabase is fully mocked — no live instance required.
The `client` fixture (from conftest.py) overrides `get_current_user` with MOCK_USER.
Each test patches `app.api.v1.reviews.get_user_supabase` to control DB responses.
"""
from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient

from app.main import app
from tests.conftest import AUTH_HEADERS, MOCK_USER

# Use valid UUIDs — ReviewResponse and ReviewerStub schemas validate UUID fields
MOCK_MERCHANT_ID = "aaaaaaaa-0000-0000-0000-000000000001"
MOCK_REVIEW_ID = "bbbbbbbb-0000-0000-0000-000000000002"
# MOCK_USER["id"] is "user-123" (not a UUID) — use a proper UUID for reviewer_id
# so ReviewerStub(id=...) does not raise a validation error.
MOCK_USER_ID = "00000000-0000-0000-0000-000000000003"

MOCK_REVIEW_ROW = {
    "id": MOCK_REVIEW_ID,
    "merchant_id": MOCK_MERCHANT_ID,
    "reviewer_id": MOCK_USER_ID,
    "rating": 4,
    "body": "Great service",
    "created_at": "2024-03-01T10:00:00Z",
    "profiles": {
        "id": MOCK_USER_ID,
        "full_name": "Test User",
        "avatar_url": None,
    },
}
MOCK_MERCHANT_ROW = {"avg_rating": "4.00"}


def _make_mock_sb():
    return MagicMock()


def _make_reviews_table_mock(rows, count):
    """Build a table mock for the reviews SELECT chain."""
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


def _make_merchant_table_mock(avg_rating_str):
    """Build a table mock for the merchants SELECT single chain."""
    mock = MagicMock()
    execute_result = MagicMock()
    execute_result.data = {"avg_rating": avg_rating_str}
    (
        mock.select.return_value
        .eq.return_value
        .single.return_value
        .execute.return_value
    ) = execute_result
    return mock


def _make_create_sb_mock(insert_row, fetch_row):
    """Build a mock_sb for create_review: insert table + select/re-fetch table."""
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
# TestListReviews
# ---------------------------------------------------------------------------

class TestListReviews:
    def test_list_reviews_200(self, client):
        """GET /merchants/{id}/reviews — returns data[], count, avg_rating."""
        mock_sb = _make_mock_sb()
        mock_sb.table.side_effect = [
            _make_reviews_table_mock([MOCK_REVIEW_ROW], 1),
            _make_merchant_table_mock("4.00"),
        ]

        with patch("app.api.v1.reviews.get_user_supabase", return_value=mock_sb):
            resp = client.get(
                f"/api/v1/merchants/{MOCK_MERCHANT_ID}/reviews",
                headers=AUTH_HEADERS,
            )

        assert resp.status_code == 200
        body = resp.json()
        assert body["count"] == 1
        assert body["avg_rating"] == 4.0
        assert len(body["data"]) == 1
        review = body["data"][0]
        assert review["rating"] == 4
        assert review["body"] == "Great service"
        assert review["reviewer"]["full_name"] == "Test User"

    def test_list_reviews_empty(self, client):
        """GET /merchants/{id}/reviews — returns empty list when no reviews."""
        mock_sb = _make_mock_sb()
        mock_sb.table.side_effect = [
            _make_reviews_table_mock([], 0),
            _make_merchant_table_mock(None),
        ]

        with patch("app.api.v1.reviews.get_user_supabase", return_value=mock_sb):
            resp = client.get(
                f"/api/v1/merchants/{MOCK_MERCHANT_ID}/reviews",
                headers=AUTH_HEADERS,
            )

        assert resp.status_code == 200
        body = resp.json()
        assert body["count"] == 0
        assert body["avg_rating"] == 0.0
        assert body["data"] == []

    def test_list_reviews_pagination_params(self, client):
        """GET /merchants/{id}/reviews with limit/offset — params accepted."""
        mock_sb = _make_mock_sb()
        mock_sb.table.side_effect = [
            _make_reviews_table_mock([], 0),
            _make_merchant_table_mock("0.00"),
        ]

        with patch("app.api.v1.reviews.get_user_supabase", return_value=mock_sb):
            resp = client.get(
                f"/api/v1/merchants/{MOCK_MERCHANT_ID}/reviews",
                params={"limit": 5, "offset": 10},
                headers=AUTH_HEADERS,
            )

        assert resp.status_code == 200
        body = resp.json()
        assert "data" in body
        assert "count" in body
        assert "avg_rating" in body


# ---------------------------------------------------------------------------
# TestCreateReview
# ---------------------------------------------------------------------------

class TestCreateReview:
    def _base_insert_row(self, rating=4, body="Great service"):
        return {
            "id": MOCK_REVIEW_ID,
            "merchant_id": MOCK_MERCHANT_ID,
            "reviewer_id": MOCK_USER_ID,
            "rating": rating,
            "body": body,
            "created_at": "2024-03-01T10:00:00Z",
        }

    def _base_fetch_row(self, rating=4, body="Great service"):
        return {
            **self._base_insert_row(rating, body),
            "profiles": {
                "id": MOCK_USER_ID,
                "full_name": "Test User",
                "avatar_url": None,
            },
        }

    def test_create_review_201(self, client):
        """POST /merchants/{id}/reviews — success returns 201 + ReviewResponse."""
        mock_sb = _make_create_sb_mock(
            insert_row=self._base_insert_row(),
            fetch_row=self._base_fetch_row(),
        )

        with patch("app.api.v1.reviews.get_user_supabase", return_value=mock_sb):
            resp = client.post(
                f"/api/v1/merchants/{MOCK_MERCHANT_ID}/reviews",
                json={"rating": 4, "body": "Great service"},
                headers=AUTH_HEADERS,
            )

        assert resp.status_code == 201
        data = resp.json()
        assert data["rating"] == 4
        assert data["body"] == "Great service"
        assert data["merchant_id"] == MOCK_MERCHANT_ID

    def test_create_review_409_duplicate(self, client):
        """POST /merchants/{id}/reviews twice — returns 409 on duplicate."""
        mock_sb = _make_mock_sb()
        mock_sb.table.return_value.insert.return_value.execute.side_effect = Exception(
            "duplicate key violates unique constraint"
        )

        with patch("app.api.v1.reviews.get_user_supabase", return_value=mock_sb):
            resp = client.post(
                f"/api/v1/merchants/{MOCK_MERCHANT_ID}/reviews",
                json={"rating": 4, "body": "Great service"},
                headers=AUTH_HEADERS,
            )

        assert resp.status_code == 409
        assert "already" in resp.json()["detail"].lower()

    def test_create_review_403_self_review(self, client):
        """POST /merchants/{id}/reviews on own merchant — returns 403."""
        mock_sb = _make_mock_sb()
        mock_sb.table.return_value.insert.return_value.execute.side_effect = Exception(
            "violates row-level security policy"
        )

        with patch("app.api.v1.reviews.get_user_supabase", return_value=mock_sb):
            resp = client.post(
                f"/api/v1/merchants/{MOCK_MERCHANT_ID}/reviews",
                json={"rating": 4},
                headers=AUTH_HEADERS,
            )

        assert resp.status_code == 403

    def test_create_review_rating_0_422(self, client):
        """POST /merchants/{id}/reviews with rating=0 — Pydantic returns 422."""
        resp = client.post(
            f"/api/v1/merchants/{MOCK_MERCHANT_ID}/reviews",
            json={"rating": 0},
            headers=AUTH_HEADERS,
        )
        assert resp.status_code == 422

    def test_create_review_rating_6_422(self, client):
        """POST /merchants/{id}/reviews with rating=6 — Pydantic returns 422."""
        resp = client.post(
            f"/api/v1/merchants/{MOCK_MERCHANT_ID}/reviews",
            json={"rating": 6},
            headers=AUTH_HEADERS,
        )
        assert resp.status_code == 422

    def test_create_review_rating_1_201(self, client):
        """POST /merchants/{id}/reviews with rating=1 (min boundary) — returns 201."""
        mock_sb = _make_create_sb_mock(
            insert_row=self._base_insert_row(rating=1, body=None),
            fetch_row=self._base_fetch_row(rating=1, body=None),
        )

        with patch("app.api.v1.reviews.get_user_supabase", return_value=mock_sb):
            resp = client.post(
                f"/api/v1/merchants/{MOCK_MERCHANT_ID}/reviews",
                json={"rating": 1},
                headers=AUTH_HEADERS,
            )

        assert resp.status_code == 201
        assert resp.json()["rating"] == 1

    def test_create_review_rating_5_201(self, client):
        """POST /merchants/{id}/reviews with rating=5 (max boundary) — returns 201."""
        mock_sb = _make_create_sb_mock(
            insert_row=self._base_insert_row(rating=5, body="Perfect!"),
            fetch_row=self._base_fetch_row(rating=5, body="Perfect!"),
        )

        with patch("app.api.v1.reviews.get_user_supabase", return_value=mock_sb):
            resp = client.post(
                f"/api/v1/merchants/{MOCK_MERCHANT_ID}/reviews",
                json={"rating": 5, "body": "Perfect!"},
                headers=AUTH_HEADERS,
            )

        assert resp.status_code == 201
        assert resp.json()["rating"] == 5

    def test_create_review_unauthenticated_401(self):
        """POST /merchants/{id}/reviews with invalid token — returns 401.

        get_current_user requires the Authorization header to be present
        (FastAPI returns 422 if the header is missing entirely).
        Sending a garbage token causes get_current_user to raise 401.
        """
        raw_client = TestClient(app, raise_server_exceptions=False)
        resp = raw_client.post(
            f"/api/v1/merchants/{MOCK_MERCHANT_ID}/reviews",
            json={"rating": 4},
            headers={"Authorization": "Bearer invalid-garbage-token"},
        )
        assert resp.status_code == 401


# ---------------------------------------------------------------------------
# TestUpdateReview
# ---------------------------------------------------------------------------

class TestUpdateReview:
    def test_update_review_200(self, client):
        """PATCH /merchants/{id}/reviews/{rid} — own review updated, returns 200."""
        updated_row = {**MOCK_REVIEW_ROW, "rating": 5, "body": "Even better!"}

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

        with patch("app.api.v1.reviews.get_user_supabase", return_value=mock_sb):
            resp = client.patch(
                f"/api/v1/merchants/{MOCK_MERCHANT_ID}/reviews/{MOCK_REVIEW_ID}",
                json={"rating": 5, "body": "Even better!"},
                headers=AUTH_HEADERS,
            )

        assert resp.status_code == 200
        data = resp.json()
        assert data["rating"] == 5
        assert data["body"] == "Even better!"

    def test_update_review_403_not_owner(self, client):
        """PATCH /merchants/{id}/reviews/{rid} for another user's review — returns 403."""
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

        with patch("app.api.v1.reviews.get_user_supabase", return_value=mock_sb):
            resp = client.patch(
                f"/api/v1/merchants/{MOCK_MERCHANT_ID}/reviews/{MOCK_REVIEW_ID}",
                json={"rating": 2},
                headers=AUTH_HEADERS,
            )

        assert resp.status_code == 403

    def test_update_review_422_no_fields(self, client):
        """PATCH /merchants/{id}/reviews/{rid} with empty body — returns 422.

        Route raises HTTPException(422) before any DB call; no mock needed.
        """
        resp = client.patch(
            f"/api/v1/merchants/{MOCK_MERCHANT_ID}/reviews/{MOCK_REVIEW_ID}",
            json={},
            headers=AUTH_HEADERS,
        )
        assert resp.status_code == 422


# ---------------------------------------------------------------------------
# TestDeleteReview
# ---------------------------------------------------------------------------

class TestDeleteReview:
    def test_delete_review_204(self, client):
        """DELETE /merchants/{id}/reviews/{rid} — own review deleted, returns 204."""
        mock_sb = _make_mock_sb()
        delete_execute = MagicMock()
        delete_execute.data = [MOCK_REVIEW_ROW]
        (
            mock_sb.table.return_value
            .delete.return_value
            .eq.return_value
            .eq.return_value
            .eq.return_value
            .execute.return_value
        ) = delete_execute

        with patch("app.api.v1.reviews.get_user_supabase", return_value=mock_sb):
            resp = client.delete(
                f"/api/v1/merchants/{MOCK_MERCHANT_ID}/reviews/{MOCK_REVIEW_ID}",
                headers=AUTH_HEADERS,
            )

        assert resp.status_code == 204

    def test_delete_review_403_not_owner(self, client):
        """DELETE /merchants/{id}/reviews/{rid} for another user's review — returns 403."""
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

        with patch("app.api.v1.reviews.get_user_supabase", return_value=mock_sb):
            resp = client.delete(
                f"/api/v1/merchants/{MOCK_MERCHANT_ID}/reviews/{MOCK_REVIEW_ID}",
                headers=AUTH_HEADERS,
            )

        assert resp.status_code == 403

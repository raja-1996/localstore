"""
Unit tests for /api/v1/follows endpoints (S6-T1).

Supabase is fully mocked — no live instance required.
The `client` fixture (from conftest.py) overrides `get_current_user` with MOCK_USER.
Each test patches `app.api.v1.follows.get_user_supabase` to control DB responses.
"""
from unittest.mock import MagicMock, patch

from tests.conftest import AUTH_HEADERS, MOCK_USER

MOCK_MERCHANT_ID = "merchant-abc"
MOCK_FOLLOW_ROW = {
    "follower_id": MOCK_USER["id"],
    "merchant_id": MOCK_MERCHANT_ID,
    "created_at": "2024-03-01T10:00:00Z",
}
MOCK_PROFILE_ROW = {
    "follower_id": "user-456",
    "profiles": {
        "id": "user-456",
        "full_name": "Alice",
        "avatar_url": "https://example.com/alice.jpg",
    },
}
MOCK_MERCHANT_CARD = {
    "id": MOCK_MERCHANT_ID,
    "name": "Glow Studio",
    "category": "Beauty",
    "avg_rating": "4.50",
    "review_count": 12,
    "follower_count": 5,
    "is_verified": False,
}


def _make_mock_sb():
    return MagicMock()


# ---------------------------------------------------------------------------
# TestFollowMerchant
# ---------------------------------------------------------------------------

class TestFollowMerchant:
    def test_follow_merchant_201(self, client):
        """POST /merchants/{id}/follow — success returns 201 + FollowResponse."""
        mock_sb = _make_mock_sb()
        execute_result = MagicMock()
        execute_result.data = [MOCK_FOLLOW_ROW]
        mock_sb.table.return_value.insert.return_value.execute.return_value = execute_result

        with patch("app.api.v1.follows.get_user_supabase", return_value=mock_sb):
            resp = client.post(
                f"/api/v1/merchants/{MOCK_MERCHANT_ID}/follow",
                headers=AUTH_HEADERS,
            )

        assert resp.status_code == 201
        data = resp.json()
        assert data["merchant_id"] == MOCK_MERCHANT_ID
        assert "followed_at" in data

    def test_follow_merchant_409_duplicate(self, client):
        """POST /merchants/{id}/follow twice — second call returns 409."""
        mock_sb = _make_mock_sb()
        mock_sb.table.return_value.insert.return_value.execute.side_effect = Exception(
            "duplicate key violates unique constraint"
        )

        with patch("app.api.v1.follows.get_user_supabase", return_value=mock_sb):
            resp = client.post(
                f"/api/v1/merchants/{MOCK_MERCHANT_ID}/follow",
                headers=AUTH_HEADERS,
            )

        assert resp.status_code == 409
        assert "already following" in resp.json()["detail"].lower()

    def test_follow_merchant_500_on_unexpected_error(self, client):
        """Non-duplicate DB error surfaces as 500."""
        mock_sb = _make_mock_sb()
        mock_sb.table.return_value.insert.return_value.execute.side_effect = Exception(
            "connection timeout"
        )

        with patch("app.api.v1.follows.get_user_supabase", return_value=mock_sb):
            resp = client.post(
                f"/api/v1/merchants/{MOCK_MERCHANT_ID}/follow",
                headers=AUTH_HEADERS,
            )

        assert resp.status_code == 500


# ---------------------------------------------------------------------------
# TestUnfollowMerchant
# ---------------------------------------------------------------------------

class TestUnfollowMerchant:
    def test_unfollow_merchant_204(self, client):
        """DELETE /merchants/{id}/follow — success returns 204 No Content."""
        mock_sb = _make_mock_sb()
        execute_result = MagicMock()
        execute_result.data = [MOCK_FOLLOW_ROW]
        mock_sb.table.return_value.delete.return_value.eq.return_value.eq.return_value.execute.return_value = execute_result

        with patch("app.api.v1.follows.get_user_supabase", return_value=mock_sb):
            resp = client.delete(
                f"/api/v1/merchants/{MOCK_MERCHANT_ID}/follow",
                headers=AUTH_HEADERS,
            )

        assert resp.status_code == 204

    def test_unfollow_merchant_404_not_following(self, client):
        """DELETE /merchants/{id}/follow when not following — returns 404."""
        mock_sb = _make_mock_sb()
        execute_result = MagicMock()
        execute_result.data = []
        mock_sb.table.return_value.delete.return_value.eq.return_value.eq.return_value.execute.return_value = execute_result

        with patch("app.api.v1.follows.get_user_supabase", return_value=mock_sb):
            resp = client.delete(
                f"/api/v1/merchants/{MOCK_MERCHANT_ID}/follow",
                headers=AUTH_HEADERS,
            )

        assert resp.status_code == 404


# ---------------------------------------------------------------------------
# TestGetFollowers
# ---------------------------------------------------------------------------

class TestGetFollowers:
    def test_get_followers_returns_list(self, client):
        """GET /merchants/{id}/followers — returns data[] + count."""
        mock_sb = _make_mock_sb()
        execute_result = MagicMock()
        execute_result.data = [MOCK_PROFILE_ROW]
        execute_result.count = 1
        (
            mock_sb.table.return_value
            .select.return_value
            .eq.return_value
            .limit.return_value
            .offset.return_value
            .execute.return_value
        ) = execute_result

        with patch("app.api.v1.follows.get_user_supabase", return_value=mock_sb):
            resp = client.get(
                f"/api/v1/merchants/{MOCK_MERCHANT_ID}/followers",
                headers=AUTH_HEADERS,
            )

        assert resp.status_code == 200
        body = resp.json()
        assert body["count"] == 1
        assert len(body["data"]) == 1
        assert body["data"][0]["id"] == "user-456"
        assert body["data"][0]["display_name"] == "Alice"

    def test_get_followers_empty(self, client):
        """GET /merchants/{id}/followers — returns empty list when no followers."""
        mock_sb = _make_mock_sb()
        execute_result = MagicMock()
        execute_result.data = []
        execute_result.count = 0
        (
            mock_sb.table.return_value
            .select.return_value
            .eq.return_value
            .limit.return_value
            .offset.return_value
            .execute.return_value
        ) = execute_result

        with patch("app.api.v1.follows.get_user_supabase", return_value=mock_sb):
            resp = client.get(
                f"/api/v1/merchants/{MOCK_MERCHANT_ID}/followers",
                headers=AUTH_HEADERS,
            )

        assert resp.status_code == 200
        body = resp.json()
        assert body["count"] == 0
        assert body["data"] == []

    def test_get_followers_pagination_params(self, client):
        """GET /merchants/{id}/followers with limit/offset — params accepted."""
        mock_sb = _make_mock_sb()
        execute_result = MagicMock()
        execute_result.data = []
        execute_result.count = 0
        (
            mock_sb.table.return_value
            .select.return_value
            .eq.return_value
            .limit.return_value
            .offset.return_value
            .execute.return_value
        ) = execute_result

        with patch("app.api.v1.follows.get_user_supabase", return_value=mock_sb):
            resp = client.get(
                f"/api/v1/merchants/{MOCK_MERCHANT_ID}/followers",
                params={"limit": 5, "offset": 10},
                headers=AUTH_HEADERS,
            )

        assert resp.status_code == 200
        body = resp.json()
        assert "data" in body
        assert "count" in body

    def test_get_followers_invalid_limit(self, client):
        """GET /merchants/{id}/followers with invalid limit — FastAPI returns 422."""
        # Test limit=0 (below ge=1 constraint)
        resp = client.get(
            f"/api/v1/merchants/{MOCK_MERCHANT_ID}/followers",
            params={"limit": 0},
            headers=AUTH_HEADERS,
        )
        assert resp.status_code == 422

        # Test limit=200 (above le=100 constraint)
        resp = client.get(
            f"/api/v1/merchants/{MOCK_MERCHANT_ID}/followers",
            params={"limit": 200},
            headers=AUTH_HEADERS,
        )
        assert resp.status_code == 422


# ---------------------------------------------------------------------------
# TestGetFollowing
# ---------------------------------------------------------------------------

class TestGetFollowing:
    def test_get_following_returns_merchant_list(self, client):
        """GET /users/me/following — returns merchant cards the user follows."""
        mock_sb = _make_mock_sb()
        execute_result = MagicMock()
        execute_result.data = [
            {"merchant_id": MOCK_MERCHANT_ID, "merchants": MOCK_MERCHANT_CARD}
        ]
        execute_result.count = 1
        (
            mock_sb.table.return_value
            .select.return_value
            .eq.return_value
            .execute.return_value
        ) = execute_result

        with patch("app.api.v1.follows.get_user_supabase", return_value=mock_sb):
            resp = client.get("/api/v1/users/me/following", headers=AUTH_HEADERS)

        assert resp.status_code == 200
        body = resp.json()
        assert body["count"] == 1
        assert len(body["data"]) == 1
        card = body["data"][0]
        assert card["id"] == MOCK_MERCHANT_ID
        assert card["name"] == "Glow Studio"
        assert card["category"] == "Beauty"

    def test_get_following_empty_when_not_following(self, client):
        """GET /users/me/following — returns empty list when user follows nobody."""
        mock_sb = _make_mock_sb()
        execute_result = MagicMock()
        execute_result.data = []
        execute_result.count = 0
        (
            mock_sb.table.return_value
            .select.return_value
            .eq.return_value
            .execute.return_value
        ) = execute_result

        with patch("app.api.v1.follows.get_user_supabase", return_value=mock_sb):
            resp = client.get("/api/v1/users/me/following", headers=AUTH_HEADERS)

        assert resp.status_code == 200
        body = resp.json()
        assert body["count"] == 0
        assert body["data"] == []

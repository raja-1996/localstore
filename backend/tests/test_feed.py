"""
Unit tests for /api/v1/feed/nearby endpoint.

Supabase .rpc() is mocked. Tests verify:
- Returns paginated NearbyFeedItem list
- Cursor pagination (has_more, next_cursor)
- Missing lat/lng returns 422
- Category filter
- Empty results
- Invalid category enum returns 422
"""
from unittest.mock import MagicMock, patch

from tests.conftest import AUTH_HEADERS


MOCK_FEED_ROW = {
    "id": "merchant-123",
    "user_id": "user-456",
    "name": "Test Merchant",
    "description": "A test merchant",
    "category": "Beauty",
    "tags": [],
    "address_text": None,
    "neighborhood": "Banjara Hills",
    "service_radius_meters": 5000,
    "phone": "+911234560000",
    "whatsapp": None,
    "avg_rating": "4.20",
    "review_count": 5,
    "follower_count": 10,
    "response_time_minutes": None,
    "is_verified": True,
    "is_active": True,
    "video_intro_url": None,
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z",
    "lat": 17.385,
    "lng": 78.4867,
    "distance_meters": 450.32,
}


def _make_mock_sb(rpc_data=None):
    mock_sb = MagicMock()
    mock_sb.rpc.return_value.execute.return_value.data = rpc_data or []
    return mock_sb


class TestFeedNearby:
    def test_returns_nearby_merchants(self, client):
        mock_sb = _make_mock_sb(rpc_data=[MOCK_FEED_ROW])

        with patch("app.api.v1.feed.get_user_supabase", return_value=mock_sb):
            resp = client.get(
                "/api/v1/feed/nearby",
                params={"lat": 17.385, "lng": 78.4867},
                headers=AUTH_HEADERS,
            )

        assert resp.status_code == 200
        data = resp.json()
        assert len(data["data"]) == 1
        assert data["data"][0]["id"] == "merchant-123"
        assert data["data"][0]["type"] == "merchant"
        assert data["data"][0]["distance_meters"] == 450.32
        assert data["has_more"] is False
        assert data["next_cursor"] is None

    def test_has_more_when_extra_row(self, client):
        """RPC returns limit+1 rows -> has_more=True, last row trimmed."""
        rows = [
            {**MOCK_FEED_ROW, "id": f"m-{i}", "distance_meters": float(i * 100)}
            for i in range(4)  # 3 + 1 extra = has_more
        ]
        mock_sb = _make_mock_sb(rpc_data=rows)

        with patch("app.api.v1.feed.get_user_supabase", return_value=mock_sb):
            resp = client.get(
                "/api/v1/feed/nearby",
                params={"lat": 17.385, "lng": 78.4867, "limit": 3},
                headers=AUTH_HEADERS,
            )

        assert resp.status_code == 200
        data = resp.json()
        assert len(data["data"]) == 3
        assert data["has_more"] is True
        assert data["next_cursor"] is not None
        # Cursor should encode last item's distance and id
        assert "200.0" in data["next_cursor"]
        assert "m-2" in data["next_cursor"]

    def test_missing_lat_returns_422(self, client):
        resp = client.get(
            "/api/v1/feed/nearby",
            params={"lng": 78.4867},
            headers=AUTH_HEADERS,
        )
        assert resp.status_code == 422

    def test_missing_lng_returns_422(self, client):
        resp = client.get(
            "/api/v1/feed/nearby",
            params={"lat": 17.385},
            headers=AUTH_HEADERS,
        )
        assert resp.status_code == 422

    def test_category_filter(self, client):
        mock_sb = _make_mock_sb(rpc_data=[MOCK_FEED_ROW])

        with patch("app.api.v1.feed.get_user_supabase", return_value=mock_sb):
            resp = client.get(
                "/api/v1/feed/nearby",
                params={"lat": 17.385, "lng": 78.4867, "category": "Beauty"},
                headers=AUTH_HEADERS,
            )

        assert resp.status_code == 200
        data = resp.json()
        assert all(item["category"] == "Beauty" for item in data["data"])
        # Verify RPC received the category
        rpc_call = mock_sb.rpc.call_args
        assert rpc_call[0][1]["p_category"] == "Beauty"

    def test_empty_results(self, client):
        mock_sb = _make_mock_sb(rpc_data=[])

        with patch("app.api.v1.feed.get_user_supabase", return_value=mock_sb):
            resp = client.get(
                "/api/v1/feed/nearby",
                params={"lat": 17.385, "lng": 78.4867},
                headers=AUTH_HEADERS,
            )

        assert resp.status_code == 200
        data = resp.json()
        assert data["data"] == []
        assert data["has_more"] is False

    def test_invalid_category_enum_returns_422(self, client):
        resp = client.get(
            "/api/v1/feed/nearby",
            params={"lat": 17.385, "lng": 78.4867, "category": "InvalidCat"},
            headers=AUTH_HEADERS,
        )
        assert resp.status_code == 422

    def test_no_auth_returns_422(self):
        from app.main import app
        from fastapi.testclient import TestClient

        plain_client = TestClient(app)
        resp = plain_client.get(
            "/api/v1/feed/nearby",
            params={"lat": 17.385, "lng": 78.4867},
        )
        assert resp.status_code == 422

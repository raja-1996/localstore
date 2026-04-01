"""
Unit tests for /api/v1/search endpoint.

search_service.search is patched. Tests verify:
- Returns SearchResponse with merchants + services
- Empty q returns 422
- Missing q returns 422
- lat without lng returns 422
- Category filter forwarded
- Search without location (distance_meters is None)
- No auth returns 422
- Invalid category enum returns 422
"""
from unittest.mock import patch

from tests.conftest import AUTH_HEADERS


MOCK_SEARCH_RESULT = {
    "merchants": [
        {
            "id": "merchant-123",
            "name": "Beauty Queen",
            "category": "Beauty",
            "lat": 17.385,
            "lng": 78.4867,
            "avg_rating": "4.50",
            "review_count": 10,
            "follower_count": 20,
            "is_verified": True,
            "distance_meters": 300.0,
            "neighborhood": "Jubilee Hills",
            "rank_score": 0.9,
        }
    ],
    "services": [
        {
            "id": "service-456",
            "merchant_id": "merchant-123",
            "merchant_name": "Beauty Queen",
            "name": "Bridal Makeup",
            "description": "Full bridal package",
            "price": "5000.00",
            "price_unit": "per session",
            "image_url": None,
            "is_available": True,
            "distance_meters": 300.0,
            "rank_score": 0.7,
        }
    ],
}


class TestSearchEndpoint:
    def test_search_returns_merchants_and_services(self, client):
        with patch(
            "app.api.v1.search.search_service.search",
            return_value=MOCK_SEARCH_RESULT,
        ):
            resp = client.get(
                "/api/v1/search",
                params={"q": "beauty", "lat": 17.385, "lng": 78.4867},
                headers=AUTH_HEADERS,
            )

        assert resp.status_code == 200
        data = resp.json()
        assert len(data["merchants"]) == 1
        assert data["merchants"][0]["id"] == "merchant-123"
        assert len(data["services"]) == 1
        assert data["services"][0]["id"] == "service-456"
        assert data["services"][0]["merchant"]["id"] == "merchant-123"

    def test_search_empty_q_returns_422(self, client):
        resp = client.get(
            "/api/v1/search",
            params={"q": ""},
            headers=AUTH_HEADERS,
        )
        assert resp.status_code == 422

    def test_search_missing_q_returns_422(self, client):
        resp = client.get(
            "/api/v1/search",
            params={},
            headers=AUTH_HEADERS,
        )
        assert resp.status_code == 422

    def test_search_lat_without_lng_returns_422(self, client):
        with patch(
            "app.api.v1.search.search_service.search",
            return_value={"merchants": [], "services": []},
        ):
            resp = client.get(
                "/api/v1/search",
                params={"q": "beauty", "lat": 17.385},
                headers=AUTH_HEADERS,
            )
        assert resp.status_code == 422
        assert "lat and lng" in resp.json()["detail"]

    def test_search_without_location(self, client):
        result_no_dist = {
            "merchants": [
                {**MOCK_SEARCH_RESULT["merchants"][0], "distance_meters": None}
            ],
            "services": [],
        }
        with patch(
            "app.api.v1.search.search_service.search",
            return_value=result_no_dist,
        ):
            resp = client.get(
                "/api/v1/search",
                params={"q": "beauty"},
                headers=AUTH_HEADERS,
            )
        assert resp.status_code == 200
        assert resp.json()["merchants"][0]["distance_meters"] is None

    def test_search_category_filter_forwarded(self, client):
        with patch(
            "app.api.v1.search.search_service.search",
            return_value=MOCK_SEARCH_RESULT,
        ) as mock_search:
            resp = client.get(
                "/api/v1/search",
                params={"q": "beauty", "category": "Beauty"},
                headers=AUTH_HEADERS,
            )
        assert resp.status_code == 200
        # Verify search_service.search was called with category="Beauty"
        call_kwargs = mock_search.call_args[1]
        assert call_kwargs["category"] == "Beauty"

    def test_search_invalid_category_enum_returns_422(self, client):
        resp = client.get(
            "/api/v1/search",
            params={"q": "beauty", "category": "NotACategory"},
            headers=AUTH_HEADERS,
        )
        assert resp.status_code == 422

    def test_search_no_auth_returns_422(self):
        from app.main import app
        from fastapi.testclient import TestClient

        plain_client = TestClient(app)
        resp = plain_client.get(
            "/api/v1/search",
            params={"q": "beauty"},
        )
        assert resp.status_code == 422

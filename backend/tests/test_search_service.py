"""
Unit tests for app.services.search_service — pg_trgm + tsvector search.

Supabase .rpc() is mocked. Tests verify:
- search("tailor") returns merchants + services
- empty query raises ValueError
- category filter is passed to RPC
- lat/lng validation
- empty results return empty lists
"""
import math
from unittest.mock import MagicMock

import pytest

from app.services.search_service import search


MOCK_MERCHANT_ROW = {
    "id": "merchant-123",
    "user_id": "user-123",
    "name": "Master Tailor",
    "description": "Expert tailoring",
    "category": "Tailoring",
    "tags": ["tailoring", "alterations"],
    "address_text": None,
    "neighborhood": "Banjara Hills",
    "service_radius_meters": 5000,
    "phone": "+911234560000",
    "whatsapp": None,
    "avg_rating": "4.50",
    "review_count": 10,
    "follower_count": 5,
    "response_time_minutes": None,
    "is_verified": True,
    "is_active": True,
    "video_intro_url": None,
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z",
    "lat": 17.385,
    "lng": 78.4867,
    "distance_meters": 450.0,
    "rank_score": 0.85,
}

MOCK_SERVICE_ROW = {
    "id": "service-456",
    "merchant_id": "merchant-123",
    "merchant_name": "Master Tailor",
    "name": "Bridal Tailoring",
    "description": "Custom bridal wear",
    "price": "5000.00",
    "price_unit": "per item",
    "image_url": None,
    "is_available": True,
    "distance_meters": 450.0,
    "rank_score": 0.6,
}


def _make_mock_sb(merchant_data=None, service_data=None):
    """Create a mock Supabase client with .rpc() returning provided data."""
    mock_sb = MagicMock()

    def rpc_side_effect(func_name, params):
        mock_result = MagicMock()
        if func_name == "search_merchants":
            mock_result.execute.return_value.data = merchant_data or []
        elif func_name == "search_services":
            mock_result.execute.return_value.data = service_data or []
        else:
            mock_result.execute.return_value.data = []
        return mock_result

    mock_sb.rpc.side_effect = rpc_side_effect
    return mock_sb


class TestSearch:
    def test_search_returns_merchants_and_services(self):
        mock_sb = _make_mock_sb(
            merchant_data=[MOCK_MERCHANT_ROW],
            service_data=[MOCK_SERVICE_ROW],
        )
        result = search(mock_sb, "tailor", lat=17.385, lng=78.4867)
        assert len(result["merchants"]) == 1
        assert result["merchants"][0]["name"] == "Master Tailor"
        assert len(result["services"]) == 1
        assert result["services"][0]["name"] == "Bridal Tailoring"

    def test_search_partial_name_match(self):
        mock_sb = _make_mock_sb(merchant_data=[MOCK_MERCHANT_ROW])
        result = search(mock_sb, "tailor")
        assert len(result["merchants"]) == 1
        assert "Tailor" in result["merchants"][0]["name"]

    def test_search_empty_query_raises_value_error(self):
        mock_sb = _make_mock_sb()
        with pytest.raises(ValueError, match="must not be empty"):
            search(mock_sb, "")

    def test_search_whitespace_query_raises_value_error(self):
        mock_sb = _make_mock_sb()
        with pytest.raises(ValueError, match="must not be empty"):
            search(mock_sb, "   ")

    def test_search_category_filter_passed_to_rpc(self):
        mock_sb = _make_mock_sb(merchant_data=[MOCK_MERCHANT_ROW])
        search(mock_sb, "tailor", category="Tailoring")
        # Verify the RPC was called with category param
        calls = mock_sb.rpc.call_args_list
        merchant_call = [c for c in calls if c[0][0] == "search_merchants"][0]
        assert merchant_call[0][1]["p_category"] == "Tailoring"

    def test_search_no_results_returns_empty_lists(self):
        mock_sb = _make_mock_sb(merchant_data=[], service_data=[])
        result = search(mock_sb, "nonexistent")
        assert result["merchants"] == []
        assert result["services"] == []

    def test_search_lat_without_lng_raises_value_error(self):
        mock_sb = _make_mock_sb()
        with pytest.raises(ValueError, match="Both lat and lng"):
            search(mock_sb, "tailor", lat=17.385)

    def test_search_invalid_lat_raises_value_error(self):
        mock_sb = _make_mock_sb()
        with pytest.raises(ValueError, match="lat must be in"):
            search(mock_sb, "tailor", lat=91.0, lng=78.0)

    def test_search_nan_lat_raises_value_error(self):
        mock_sb = _make_mock_sb()
        with pytest.raises(ValueError, match="finite"):
            search(mock_sb, "tailor", lat=math.nan, lng=78.0)

    def test_search_without_location_returns_no_distance(self):
        merchant_no_dist = {**MOCK_MERCHANT_ROW, "distance_meters": None}
        mock_sb = _make_mock_sb(merchant_data=[merchant_no_dist])
        result = search(mock_sb, "tailor")
        assert result["merchants"][0]["distance_meters"] is None

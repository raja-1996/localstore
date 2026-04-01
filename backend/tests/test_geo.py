"""
Unit tests for app.services.geo — pure functions, no HTTP or Supabase needed.

Tests cover:
- point_from_latlng: valid inputs, coordinate ordering, out-of-bounds, NaN
- nearby_query: valid inputs, SQL string content, invalid radius, NaN lat
"""
import math

import pytest

from app.services.geo import nearby_query, point_from_latlng


class TestPointFromLatlng:
    def test_basic(self):
        result = point_from_latlng(12.9716, 77.5946)
        assert result == "POINT(77.5946 12.9716)"

    def test_longitude_comes_first_in_string(self):
        """PostGIS WKT is POINT(lng lat) — longitude must come first."""
        result = point_from_latlng(10.0, 20.0)
        assert result == "POINT(20.0 10.0)"

    def test_out_of_bounds_lat(self):
        with pytest.raises(ValueError, match="lat must be in"):
            point_from_latlng(91.0, 0.0)

    def test_out_of_bounds_lng(self):
        with pytest.raises(ValueError, match="lng must be in"):
            point_from_latlng(0.0, 181.0)

    def test_nan_raises(self):
        with pytest.raises(ValueError, match="finite"):
            point_from_latlng(math.nan, 0.0)


class TestNearbyQuery:
    def test_returns_st_dwithin_string(self):
        result = nearby_query(12.9716, 77.5946, 1000)
        assert "ST_DWithin" in result

    def test_contains_geography_cast(self):
        result = nearby_query(12.9716, 77.5946, 1000)
        assert "geography" in result

    def test_invalid_radius_raises(self):
        with pytest.raises(ValueError, match="radius_m must be > 0"):
            nearby_query(12.9716, 77.5946, 0)

    def test_nan_lat_raises(self):
        with pytest.raises(ValueError, match="finite"):
            nearby_query(math.nan, 77.5946, 1000)

    def test_negative_radius_raises(self):
        with pytest.raises(ValueError, match="radius_m must be > 0"):
            nearby_query(12.9716, 77.5946, -500)

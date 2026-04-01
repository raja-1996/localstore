"""
Unit tests for /api/v1/merchants endpoints.

Supabase is fully mocked — no live instance required.
The `client` fixture (from conftest.py) overrides `get_current_user` with MOCK_USER.
Each test patches `app.api.v1.merchants.get_user_supabase` to control DB responses.
`check_merchant_owner` is patched separately for 403 ownership tests.
"""
from unittest.mock import MagicMock, patch

from fastapi import HTTPException

from tests.conftest import AUTH_HEADERS

MOCK_MERCHANT = {
    "id": "merchant-123",
    "user_id": "user-123",
    "name": "Test Merchant",
    "category": "Beauty",
    "description": "A test merchant",
    "lat": 0.0,
    "lng": 0.0,
    "avg_rating": "0.00",
    "review_count": 0,
    "follower_count": 0,
    "is_verified": False,
    "is_active": True,
    "distance_meters": None,
    "address_text": None,
    "neighborhood": None,
    "service_radius_meters": 5000,
    "tags": [],
    "video_intro_url": None,
    "phone": "+911234560000",
    "whatsapp": None,
    "response_time_minutes": None,
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z",
}


def _make_mock_sb():
    return MagicMock()


def _sb_returns(mock_sb, data: list):
    """Set .table().select().eq().execute().data for simple query chains."""
    mock_sb.table.return_value.select.return_value.eq.return_value.execute.return_value.data = data
    return mock_sb


class TestListMerchants:
    def test_list_returns_merchants(self, client):
        mock_sb = _make_mock_sb()
        # list_merchants builds a chained query: .select().eq().limit().offset().execute()
        mock_sb.table.return_value.select.return_value.eq.return_value.limit.return_value.offset.return_value.execute.return_value.data = [
            MOCK_MERCHANT
        ]

        with patch("app.api.v1.merchants.get_user_supabase", return_value=mock_sb):
            resp = client.get(
                "/api/v1/merchants",
                params={"lat": 12.9716, "lng": 77.5946},
                headers=AUTH_HEADERS,
            )

        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert data[0]["id"] == "merchant-123"
        assert data[0]["name"] == "Test Merchant"

    def test_list_with_category_filter(self, client):
        mock_sb = _make_mock_sb()
        # category filter adds an extra .eq() before .limit()
        mock_sb.table.return_value.select.return_value.eq.return_value.eq.return_value.limit.return_value.offset.return_value.execute.return_value.data = [
            MOCK_MERCHANT
        ]

        with patch("app.api.v1.merchants.get_user_supabase", return_value=mock_sb):
            resp = client.get(
                "/api/v1/merchants",
                params={"lat": 12.9716, "lng": 77.5946, "category": "Beauty"},
                headers=AUTH_HEADERS,
            )

        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert data[0]["category"] == "Beauty"

    def test_list_with_q_filter(self, client):
        mock_sb = _make_mock_sb()
        # q filter adds .text_search() before .limit()
        mock_sb.table.return_value.select.return_value.eq.return_value.text_search.return_value.limit.return_value.offset.return_value.execute.return_value.data = [
            MOCK_MERCHANT
        ]

        with patch("app.api.v1.merchants.get_user_supabase", return_value=mock_sb):
            resp = client.get(
                "/api/v1/merchants",
                params={"lat": 12.9716, "lng": 77.5946, "q": "beauty"},
                headers=AUTH_HEADERS,
            )

        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert data[0]["id"] == "merchant-123"

    def test_list_no_auth_returns_422(self):
        """Missing Authorization header → FastAPI validation returns 422."""
        from app.main import app
        from fastapi.testclient import TestClient

        plain_client = TestClient(app)
        resp = plain_client.get(
            "/api/v1/merchants", params={"lat": 12.9716, "lng": 77.5946}
        )
        assert resp.status_code == 422


class TestGetOwnMerchant:
    def test_get_own_merchant_success(self, client):
        mock_sb = _make_mock_sb()
        _sb_returns(mock_sb, [MOCK_MERCHANT])

        with patch("app.api.v1.merchants.get_user_supabase", return_value=mock_sb):
            resp = client.get("/api/v1/merchants/me", headers=AUTH_HEADERS)

        assert resp.status_code == 200
        data = resp.json()
        assert data["id"] == "merchant-123"
        # Owner: phone must NOT be masked
        assert data["phone"] == "+911234560000"

    def test_get_own_merchant_not_found_returns_404(self, client):
        mock_sb = _make_mock_sb()
        _sb_returns(mock_sb, [])

        with patch("app.api.v1.merchants.get_user_supabase", return_value=mock_sb):
            resp = client.get("/api/v1/merchants/me", headers=AUTH_HEADERS)

        assert resp.status_code == 404
        assert resp.json()["detail"] == "Merchant not found"


class TestCreateMerchant:
    def test_create_merchant_success(self, client):
        mock_sb = _make_mock_sb()
        mock_sb.table.return_value.insert.return_value.execute.return_value.data = [
            MOCK_MERCHANT
        ]

        with patch("app.api.v1.merchants.get_user_supabase", return_value=mock_sb):
            resp = client.post(
                "/api/v1/merchants",
                json={
                    "name": "Test Merchant",
                    "category": "Beauty",
                    "lat": 12.9716,
                    "lng": 77.5946,
                },
                headers=AUTH_HEADERS,
            )

        assert resp.status_code == 201
        data = resp.json()
        assert data["id"] == "merchant-123"
        assert data["name"] == "Test Merchant"

    def test_create_merchant_duplicate_returns_409(self, client):
        mock_sb = _make_mock_sb()
        mock_sb.table.return_value.insert.return_value.execute.side_effect = Exception(
            "duplicate key violates unique constraint"
        )

        with patch("app.api.v1.merchants.get_user_supabase", return_value=mock_sb):
            resp = client.post(
                "/api/v1/merchants",
                json={
                    "name": "Test Merchant",
                    "category": "Beauty",
                    "lat": 12.9716,
                    "lng": 77.5946,
                },
                headers=AUTH_HEADERS,
            )

        assert resp.status_code == 409
        assert "already has a merchant profile" in resp.json()["detail"]


class TestGetMerchant:
    def test_get_merchant_by_id(self, client):
        mock_sb = _make_mock_sb()
        # Use a different user_id so the requesting user is NOT the owner
        non_owner_merchant = {**MOCK_MERCHANT, "user_id": "other-user-456"}
        _sb_returns(mock_sb, [non_owner_merchant])

        with patch("app.api.v1.merchants.get_user_supabase", return_value=mock_sb):
            resp = client.get("/api/v1/merchants/merchant-123", headers=AUTH_HEADERS)

        assert resp.status_code == 200
        data = resp.json()
        assert data["id"] == "merchant-123"
        # Non-owner: phone must be masked
        assert data["phone"].startswith("*****")

    def test_get_merchant_by_id_owner_sees_unmasked_phone(self, client):
        mock_sb = _make_mock_sb()
        # user_id matches MOCK_USER["id"] so the caller is the owner
        _sb_returns(mock_sb, [MOCK_MERCHANT])

        with patch("app.api.v1.merchants.get_user_supabase", return_value=mock_sb):
            resp = client.get("/api/v1/merchants/merchant-123", headers=AUTH_HEADERS)

        assert resp.status_code == 200
        data = resp.json()
        assert data["id"] == "merchant-123"
        # Owner: phone must NOT be masked
        assert data["phone"] == MOCK_MERCHANT["phone"]

    def test_get_merchant_not_found(self, client):
        mock_sb = _make_mock_sb()
        _sb_returns(mock_sb, [])

        with patch("app.api.v1.merchants.get_user_supabase", return_value=mock_sb):
            resp = client.get("/api/v1/merchants/does-not-exist", headers=AUTH_HEADERS)

        assert resp.status_code == 404
        assert resp.json()["detail"] == "Merchant not found"


class TestUpdateMerchant:
    def test_update_merchant_success(self, client):
        updated = {**MOCK_MERCHANT, "name": "Updated Name"}
        mock_sb = _make_mock_sb()
        mock_sb.table.return_value.update.return_value.eq.return_value.execute.return_value.data = [
            updated
        ]

        with patch("app.api.v1.merchants.get_user_supabase", return_value=mock_sb), patch(
            "app.api.v1.merchants.check_merchant_owner"
        ):
            resp = client.patch(
                "/api/v1/merchants/merchant-123",
                json={"name": "Updated Name"},
                headers=AUTH_HEADERS,
            )

        assert resp.status_code == 200
        assert resp.json()["name"] == "Updated Name"

    def test_update_merchant_empty_body_returns_400(self, client):
        mock_sb = _make_mock_sb()

        with patch("app.api.v1.merchants.get_user_supabase", return_value=mock_sb), patch(
            "app.api.v1.merchants.check_merchant_owner"
        ):
            resp = client.patch(
                "/api/v1/merchants/merchant-123",
                json={},
                headers=AUTH_HEADERS,
            )

        assert resp.status_code == 400
        assert resp.json()["detail"] == "No fields to update"

    def test_update_merchant_not_owner_returns_403(self, client):
        mock_sb = _make_mock_sb()

        with patch("app.api.v1.merchants.get_user_supabase", return_value=mock_sb), patch(
            "app.api.v1.merchants.check_merchant_owner",
            side_effect=HTTPException(status_code=403, detail="Forbidden"),
        ):
            resp = client.patch(
                "/api/v1/merchants/merchant-123",
                json={"name": "Hacked Name"},
                headers=AUTH_HEADERS,
            )

        assert resp.status_code == 403


class TestDeleteMerchant:
    def test_delete_merchant_success(self, client):
        mock_sb = _make_mock_sb()
        mock_sb.table.return_value.update.return_value.eq.return_value.execute.return_value.data = [
            {**MOCK_MERCHANT, "is_active": False}
        ]

        with patch("app.api.v1.merchants.get_user_supabase", return_value=mock_sb), patch(
            "app.api.v1.merchants.check_merchant_owner"
        ):
            resp = client.delete(
                "/api/v1/merchants/merchant-123", headers=AUTH_HEADERS
            )

        assert resp.status_code == 204

    def test_delete_merchant_not_owner_returns_403(self, client):
        mock_sb = _make_mock_sb()

        with patch("app.api.v1.merchants.get_user_supabase", return_value=mock_sb), patch(
            "app.api.v1.merchants.check_merchant_owner",
            side_effect=HTTPException(status_code=403, detail="Forbidden"),
        ):
            resp = client.delete(
                "/api/v1/merchants/merchant-123", headers=AUTH_HEADERS
            )

        assert resp.status_code == 403

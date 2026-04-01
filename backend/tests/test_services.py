"""
Unit tests for /api/v1/merchants/{merchant_id}/services endpoints.

Supabase is fully mocked — no live instance required.
The `client` fixture (from conftest.py) overrides `get_current_user` with MOCK_USER.
Each test patches `app.api.v1.services.get_user_supabase` to control DB responses.
`check_merchant_owner` is patched separately for 403 ownership tests.
"""
from unittest.mock import MagicMock, patch

from fastapi import HTTPException

from tests.conftest import AUTH_HEADERS

MOCK_SERVICE = {
    "id": "service-123",
    "merchant_id": "merchant-123",
    "name": "Haircut",
    "description": "Basic cut",
    "price": "150.00",
    "price_unit": "per visit",
    "image_url": None,
    "is_available": True,
    "cancellation_policy": None,
    "advance_percent": 20,
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z",
}

MERCHANT_ID = "merchant-123"
SERVICE_ID = "service-123"


def _make_mock_sb():
    return MagicMock()


class TestListServices:
    def test_list_services_success(self, client):
        mock_sb = _make_mock_sb()
        # Services found — no merchant existence check needed
        mock_sb.table.return_value.select.return_value.eq.return_value.execute.return_value.data = [
            MOCK_SERVICE
        ]

        with patch("app.api.v1.services.get_user_supabase", return_value=mock_sb):
            resp = client.get(
                f"/api/v1/merchants/{MERCHANT_ID}/services",
                headers=AUTH_HEADERS,
            )

        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert data[0]["id"] == "service-123"
        assert data[0]["name"] == "Haircut"

    def test_list_services_empty_merchant_not_found_returns_404(self, client):
        """No services AND merchant absent → 404."""
        mock_sb = _make_mock_sb()
        # Both service query and merchant check return empty
        mock_sb.table.return_value.select.return_value.eq.return_value.execute.return_value.data = []

        with patch("app.api.v1.services.get_user_supabase", return_value=mock_sb):
            resp = client.get(
                "/api/v1/merchants/nonexistent-merchant/services",
                headers=AUTH_HEADERS,
            )

        assert resp.status_code == 404
        assert resp.json()["detail"] == "Merchant not found"


class TestCreateService:
    def test_create_service_success(self, client):
        mock_sb = _make_mock_sb()
        mock_sb.table.return_value.insert.return_value.execute.return_value.data = [
            MOCK_SERVICE
        ]

        with patch("app.api.v1.services.get_user_supabase", return_value=mock_sb), patch(
            "app.api.v1.services.check_merchant_owner"
        ):
            resp = client.post(
                f"/api/v1/merchants/{MERCHANT_ID}/services",
                json={"name": "Haircut", "price": "150.00"},
                headers=AUTH_HEADERS,
            )

        assert resp.status_code == 201
        data = resp.json()
        assert data["id"] == "service-123"
        assert data["merchant_id"] == "merchant-123"
        assert data["name"] == "Haircut"


class TestUpdateService:
    def test_update_service_success(self, client):
        updated = {**MOCK_SERVICE, "name": "Premium Haircut", "price": "200.00"}
        mock_sb = _make_mock_sb()
        mock_sb.table.return_value.update.return_value.eq.return_value.eq.return_value.execute.return_value.data = [
            updated
        ]

        with patch("app.api.v1.services.get_user_supabase", return_value=mock_sb), patch(
            "app.api.v1.services.check_merchant_owner"
        ):
            resp = client.patch(
                f"/api/v1/merchants/{MERCHANT_ID}/services/{SERVICE_ID}",
                json={"name": "Premium Haircut", "price": "200.00"},
                headers=AUTH_HEADERS,
            )

        assert resp.status_code == 200
        data = resp.json()
        assert data["name"] == "Premium Haircut"
        assert data["price"] == "200.00"

    def test_update_service_empty_body_returns_400(self, client):
        mock_sb = _make_mock_sb()

        with patch("app.api.v1.services.get_user_supabase", return_value=mock_sb), patch(
            "app.api.v1.services.check_merchant_owner"
        ):
            resp = client.patch(
                f"/api/v1/merchants/{MERCHANT_ID}/services/{SERVICE_ID}",
                json={},
                headers=AUTH_HEADERS,
            )

        assert resp.status_code == 400
        assert resp.json()["detail"] == "No fields to update"

    def test_update_service_not_owner_returns_403(self, client):
        mock_sb = _make_mock_sb()

        with patch("app.api.v1.services.get_user_supabase", return_value=mock_sb), patch(
            "app.api.v1.services.check_merchant_owner",
            side_effect=HTTPException(status_code=403, detail="Forbidden"),
        ):
            resp = client.patch(
                f"/api/v1/merchants/{MERCHANT_ID}/services/{SERVICE_ID}",
                json={"name": "Hijacked"},
                headers=AUTH_HEADERS,
            )

        assert resp.status_code == 403


class TestDeleteService:
    def test_delete_service_success(self, client):
        mock_sb = _make_mock_sb()
        mock_sb.table.return_value.delete.return_value.eq.return_value.eq.return_value.execute.return_value.data = [
            MOCK_SERVICE
        ]

        with patch("app.api.v1.services.get_user_supabase", return_value=mock_sb), patch(
            "app.api.v1.services.check_merchant_owner"
        ):
            resp = client.delete(
                f"/api/v1/merchants/{MERCHANT_ID}/services/{SERVICE_ID}",
                headers=AUTH_HEADERS,
            )

        assert resp.status_code == 204

    def test_delete_service_not_found_returns_404(self, client):
        mock_sb = _make_mock_sb()
        mock_sb.table.return_value.delete.return_value.eq.return_value.eq.return_value.execute.return_value.data = []

        with patch("app.api.v1.services.get_user_supabase", return_value=mock_sb), patch(
            "app.api.v1.services.check_merchant_owner"
        ):
            resp = client.delete(
                f"/api/v1/merchants/{MERCHANT_ID}/services/missing-service",
                headers=AUTH_HEADERS,
            )

        assert resp.status_code == 404
        assert resp.json()["detail"] == "Service not found"

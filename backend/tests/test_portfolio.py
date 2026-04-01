"""
Unit tests for /api/v1/merchants/{merchant_id}/portfolio endpoints.

Supabase is fully mocked — no live instance required.
The `client` fixture (from conftest.py) overrides `get_current_user` with MOCK_USER.
Each test patches `app.api.v1.portfolio.get_user_supabase` to control DB responses.
`check_merchant_owner` is patched for all write operations.
"""
from unittest.mock import MagicMock, patch

from fastapi import HTTPException

from tests.conftest import AUTH_HEADERS
from app.api.v1.portfolio import MAX_PORTFOLIO_IMAGES

MOCK_IMAGE = {
    "id": "img-123",
    "merchant_id": "merchant-123",
    "image_url": "https://example.com/img.jpg",
    "caption": None,
    "sort_order": 0,
    "created_at": "2024-01-01T00:00:00Z",
}

MERCHANT_ID = "merchant-123"
IMAGE_ID = "img-123"


def _make_mock_sb():
    return MagicMock()


class TestListPortfolio:
    def test_list_portfolio_success(self, client):
        mock_sb = _make_mock_sb()
        # list_portfolio: .select().eq().order().execute()
        mock_sb.table.return_value.select.return_value.eq.return_value.order.return_value.execute.return_value.data = [
            MOCK_IMAGE
        ]

        with patch("app.api.v1.portfolio.get_user_supabase", return_value=mock_sb):
            resp = client.get(
                f"/api/v1/merchants/{MERCHANT_ID}/portfolio",
                headers=AUTH_HEADERS,
            )

        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert data[0]["id"] == "img-123"
        assert data[0]["image_url"] == "https://example.com/img.jpg"


class TestAddPortfolioImage:
    def test_add_image_success(self, client):
        mock_sb = _make_mock_sb()
        # Count check returns < 10 images
        count_result = MagicMock()
        count_result.count = 2
        mock_sb.table.return_value.select.return_value.eq.return_value.execute.return_value = (
            count_result
        )
        mock_sb.table.return_value.insert.return_value.execute.return_value.data = [
            MOCK_IMAGE
        ]

        with patch("app.api.v1.portfolio.get_user_supabase", return_value=mock_sb), patch(
            "app.api.v1.portfolio.check_merchant_owner"
        ):
            resp = client.post(
                f"/api/v1/merchants/{MERCHANT_ID}/portfolio",
                json={"image_url": "https://example.com/img.jpg"},
                headers=AUTH_HEADERS,
            )

        assert resp.status_code == 201
        data = resp.json()
        assert data["id"] == "img-123"
        assert data["merchant_id"] == "merchant-123"

    def test_add_image_max_10_returns_400(self, client):
        """Uploading when MAX_PORTFOLIO_IMAGES images already exist → 400."""
        mock_sb = _make_mock_sb()
        count_result = MagicMock()
        count_result.count = MAX_PORTFOLIO_IMAGES
        mock_sb.table.return_value.select.return_value.eq.return_value.execute.return_value = (
            count_result
        )

        with patch("app.api.v1.portfolio.get_user_supabase", return_value=mock_sb), patch(
            "app.api.v1.portfolio.check_merchant_owner"
        ):
            resp = client.post(
                f"/api/v1/merchants/{MERCHANT_ID}/portfolio",
                json={"image_url": "https://example.com/extra.jpg"},
                headers=AUTH_HEADERS,
            )

        assert resp.status_code == 400
        assert "Portfolio limit reached" in resp.json()["detail"]


class TestDeletePortfolioImage:
    def test_delete_image_success(self, client):
        mock_sb = _make_mock_sb()
        mock_sb.table.return_value.delete.return_value.eq.return_value.eq.return_value.execute.return_value.data = [
            MOCK_IMAGE
        ]

        with patch("app.api.v1.portfolio.get_user_supabase", return_value=mock_sb), patch(
            "app.api.v1.portfolio.check_merchant_owner"
        ):
            resp = client.delete(
                f"/api/v1/merchants/{MERCHANT_ID}/portfolio/{IMAGE_ID}",
                headers=AUTH_HEADERS,
            )

        assert resp.status_code == 204


class TestReorderPortfolio:
    def test_reorder_success(self, client):
        mock_sb = _make_mock_sb()
        # Validation query: select("id").eq().execute() returns both IDs as existing
        mock_sb.table.return_value.select.return_value.eq.return_value.execute.return_value.data = [
            {"id": "img-123"},
            {"id": "img-456"},
        ]
        # reorder issues one update per image; mock the chained call
        mock_sb.table.return_value.update.return_value.eq.return_value.eq.return_value.execute.return_value.data = [
            MOCK_IMAGE
        ]

        with patch("app.api.v1.portfolio.get_user_supabase", return_value=mock_sb), patch(
            "app.api.v1.portfolio.check_merchant_owner"
        ):
            resp = client.patch(
                f"/api/v1/merchants/{MERCHANT_ID}/portfolio/reorder",
                json={"order": ["img-123", "img-456"]},
                headers=AUTH_HEADERS,
            )

        assert resp.status_code == 200
        data = resp.json()
        assert data["reordered"] == 2

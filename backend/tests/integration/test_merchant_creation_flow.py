"""
Integration tests for the end-to-end merchant creation flow.

Covers: POST /merchants → POST /services → POST /portfolio →
        GET /merchants/{id} (verifies full data), is_merchant flag,
        duplicate merchant guard, service without merchant, portfolio max-10.

Requires a running Supabase instance. Automatically skipped if unreachable.
All tests share the session-scoped test_user fixture from conftest.

Cleanup pattern: each test creates its own merchant and deletes it via admin
Supabase client in a finally block.
"""
import pytest

from tests.integration.conftest import skip_if_no_supabase, make_merchant_payload, delete_merchant
from app.api.v1.portfolio import MAX_PORTFOLIO_IMAGES

pytestmark = skip_if_no_supabase


class TestMerchantCreationFlowIntegration:
    """S5-T2: End-to-end merchant creation pipeline tests."""

    def test_full_merchant_creation_flow(self, integration_client, test_user):
        """
        POST /merchants → POST /services → POST /portfolio (image_url JSON) →
        GET /merchants/{id} confirms services and portfolio are attached.
        """
        created_merchant_id = None
        try:
            # 1. Create merchant
            payload = make_merchant_payload()
            create_resp = integration_client.post(
                "/api/v1/merchants",
                json=payload,
                headers=test_user["auth_headers"],
            )
            assert create_resp.status_code == 201, (
                f"Merchant creation failed: {create_resp.text}"
            )
            created_merchant_id = create_resp.json()["id"]

            # 2. Add a service
            svc_resp = integration_client.post(
                f"/api/v1/merchants/{created_merchant_id}/services",
                json={"name": "Haircut", "price": 200.0, "description": "Classic haircut"},
                headers=test_user["auth_headers"],
            )
            assert svc_resp.status_code == 201, f"Service creation failed: {svc_resp.text}"
            service_id = svc_resp.json()["id"]

            # 3. Add a portfolio image (JSON, not file upload)
            img_resp = integration_client.post(
                f"/api/v1/merchants/{created_merchant_id}/portfolio",
                json={"image_url": "https://example.com/work-photo.jpg"},
                headers=test_user["auth_headers"],
            )
            assert img_resp.status_code == 201, f"Portfolio add failed: {img_resp.text}"
            portfolio_id = img_resp.json()["id"]

            # 4. GET /merchants/{id} — verify services and portfolio are present
            detail_resp = integration_client.get(
                f"/api/v1/merchants/{created_merchant_id}",
                headers=test_user["auth_headers"],
            )
            assert detail_resp.status_code == 200
            data = detail_resp.json()
            assert data["id"] == created_merchant_id
            assert data["name"] == payload["name"]

            # Verify service exists under the merchant
            svc_list_resp = integration_client.get(
                f"/api/v1/merchants/{created_merchant_id}/services",
                headers=test_user["auth_headers"],
            )
            assert svc_list_resp.status_code == 200
            service_ids = [s["id"] for s in svc_list_resp.json()]
            assert service_id in service_ids

            # Verify portfolio image exists
            portfolio_resp = integration_client.get(
                f"/api/v1/merchants/{created_merchant_id}/portfolio",
                headers=test_user["auth_headers"],
            )
            assert portfolio_resp.status_code == 200
            portfolio_ids = [p["id"] for p in portfolio_resp.json()]
            assert portfolio_id in portfolio_ids
        finally:
            if created_merchant_id:
                delete_merchant(created_merchant_id)

    def test_merchant_creation_sets_is_merchant_flag(self, integration_client, test_user):
        """
        POST /merchants → GET /users/me confirms is_merchant becomes true.
        """
        created_merchant_id = None
        try:
            resp = integration_client.post(
                "/api/v1/merchants",
                json=make_merchant_payload(),
                headers=test_user["auth_headers"],
            )
            assert resp.status_code == 201, f"Merchant creation failed: {resp.text}"
            created_merchant_id = resp.json()["id"]

            profile_resp = integration_client.get(
                "/api/v1/users/me",
                headers=test_user["auth_headers"],
            )
            assert profile_resp.status_code == 200
            assert profile_resp.json()["is_merchant"] is True, (
                f"Expected is_merchant=True after creating merchant, got: {profile_resp.json()}"
            )
        finally:
            if created_merchant_id:
                delete_merchant(created_merchant_id)

    def test_duplicate_merchant_creation_returns_409_or_400(
        self, integration_client, test_user
    ):
        """
        Second POST /merchants for the same user returns 409 (or 400) error.
        """
        created_merchant_id = None
        try:
            # First creation succeeds
            resp = integration_client.post(
                "/api/v1/merchants",
                json=make_merchant_payload(),
                headers=test_user["auth_headers"],
            )
            assert resp.status_code == 201, f"First merchant creation failed: {resp.text}"
            created_merchant_id = resp.json()["id"]

            # Second creation with same user must fail
            resp2 = integration_client.post(
                "/api/v1/merchants",
                json=make_merchant_payload(),
                headers=test_user["auth_headers"],
            )
            assert resp2.status_code in (400, 409), (
                f"Expected 409 or 400 on duplicate merchant, got {resp2.status_code}: {resp2.text}"
            )
        finally:
            if created_merchant_id:
                delete_merchant(created_merchant_id)

    def test_service_creation_requires_valid_merchant(
        self, integration_client, test_user
    ):
        """
        POST /merchants/{nonexistent-id}/services returns 404 or 422.
        """
        nonexistent_id = "00000000-0000-0000-0000-000000000000"

        resp = integration_client.post(
            f"/api/v1/merchants/{nonexistent_id}/services",
            json={"name": "Ghost Service", "price": 100.0},
            headers=test_user["auth_headers"],
        )
        assert resp.status_code in (400, 404, 422), (
            f"Expected 404 or 422 for service on nonexistent merchant, "
            f"got {resp.status_code}: {resp.text}"
        )

    def test_portfolio_enforces_max_10(self, integration_client, test_user):
        """
        Add MAX_PORTFOLIO_IMAGES images — all succeed.
        The (MAX_PORTFOLIO_IMAGES + 1)th image must be rejected with 400 or 422.
        """
        created_merchant_id = None
        try:
            create_resp = integration_client.post(
                "/api/v1/merchants",
                json=make_merchant_payload(),
                headers=test_user["auth_headers"],
            )
            assert create_resp.status_code == 201, (
                f"Merchant creation failed: {create_resp.text}"
            )
            created_merchant_id = create_resp.json()["id"]

            # Add exactly MAX_PORTFOLIO_IMAGES — all must succeed
            for i in range(MAX_PORTFOLIO_IMAGES):
                resp = integration_client.post(
                    f"/api/v1/merchants/{created_merchant_id}/portfolio",
                    json={"image_url": f"https://example.com/img-{i}.jpg"},
                    headers=test_user["auth_headers"],
                )
                assert resp.status_code == 201, (
                    f"Expected 201 for image {i}, got {resp.status_code}: {resp.text}"
                )

            # (MAX_PORTFOLIO_IMAGES + 1)th image must be rejected
            overflow_resp = integration_client.post(
                f"/api/v1/merchants/{created_merchant_id}/portfolio",
                json={"image_url": "https://example.com/overflow.jpg"},
                headers=test_user["auth_headers"],
            )
            assert overflow_resp.status_code in (400, 422), (
                f"Expected 400 or 422 for {MAX_PORTFOLIO_IMAGES + 1}th image, "
                f"got {overflow_resp.status_code}: {overflow_resp.text}"
            )
        finally:
            if created_merchant_id:
                delete_merchant(created_merchant_id)

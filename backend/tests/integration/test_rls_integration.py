"""
Integration tests for RLS enforcement on merchant write operations.

Verifies that authenticated user B cannot mutate resources owned by user A:
- PATCH /api/v1/merchants/{id}           → 403 or 404
- DELETE /api/v1/merchants/{id}          → 403 or 404
- POST /api/v1/merchants/{mid}/services  → 403 or 404
- DELETE /api/v1/merchants/{mid}/portfolio/{img_id} → 403 or 404

Uses session-scoped test_user (user A) and test_user_b (user B) from conftest.
Both are real Supabase users — no mocking.
"""
from tests.integration.conftest import skip_if_no_supabase, make_merchant_payload, delete_merchant

pytestmark = skip_if_no_supabase


# ---------------------------------------------------------------------------
# TestRLSEnforcement
# ---------------------------------------------------------------------------

class TestRLSEnforcement:
    """
    User A owns a merchant. User B tries to mutate it.
    All attempts must be rejected with 403 or 404.
    """

    def test_user_cannot_patch_others_merchant(
        self, integration_client, test_user, test_user_b
    ):
        """User B sends PATCH to user A's merchant — must get 403 or 404."""
        created_merchant_id = None
        try:
            # User A creates a merchant
            create_resp = integration_client.post(
                "/api/v1/merchants",
                json=make_merchant_payload(),
                headers=test_user["auth_headers"],
            )
            assert create_resp.status_code == 201
            created_merchant_id = create_resp.json()["id"]

            # User B tries to patch user A's merchant
            patch_resp = integration_client.patch(
                f"/api/v1/merchants/{created_merchant_id}",
                json={"name": "Hijacked by User B"},
                headers=test_user_b["auth_headers"],
            )
            assert patch_resp.status_code in (403, 404), (
                f"Expected 403 or 404, got {patch_resp.status_code}: {patch_resp.text}"
            )
        finally:
            if created_merchant_id:
                delete_merchant(created_merchant_id)

    def test_user_cannot_delete_others_merchant(
        self, integration_client, test_user, test_user_b
    ):
        """User B sends DELETE to user A's merchant — must get 403 or 404."""
        created_merchant_id = None
        try:
            # User A creates a merchant
            create_resp = integration_client.post(
                "/api/v1/merchants",
                json=make_merchant_payload(),
                headers=test_user["auth_headers"],
            )
            assert create_resp.status_code == 201
            created_merchant_id = create_resp.json()["id"]

            # User B tries to delete user A's merchant
            delete_resp = integration_client.delete(
                f"/api/v1/merchants/{created_merchant_id}",
                headers=test_user_b["auth_headers"],
            )
            assert delete_resp.status_code in (403, 404), (
                f"Expected 403 or 404, got {delete_resp.status_code}: {delete_resp.text}"
            )

            # Verify merchant still exists and is still active (not soft-deleted)
            from app.core.supabase import get_supabase
            admin_row = (
                get_supabase()
                .table("merchants")
                .select("is_active")
                .eq("id", created_merchant_id)
                .execute()
            )
            assert admin_row.data, "Merchant row should still exist after rejected delete"
            assert admin_row.data[0]["is_active"] is True, (
                "Merchant should still be active after rejected delete by non-owner"
            )
        finally:
            if created_merchant_id:
                delete_merchant(created_merchant_id)

    def test_user_cannot_add_service_to_others_merchant(
        self, integration_client, test_user, test_user_b
    ):
        """User B sends POST services to user A's merchant — must get 403 or 404."""
        created_merchant_id = None
        try:
            # User A creates a merchant
            create_resp = integration_client.post(
                "/api/v1/merchants",
                json=make_merchant_payload(),
                headers=test_user["auth_headers"],
            )
            assert create_resp.status_code == 201
            created_merchant_id = create_resp.json()["id"]

            # User B tries to add a service to user A's merchant
            svc_resp = integration_client.post(
                f"/api/v1/merchants/{created_merchant_id}/services",
                json={"name": "Injected Service", "price": 100.0},
                headers=test_user_b["auth_headers"],
            )
            assert svc_resp.status_code in (403, 404), (
                f"Expected 403 or 404, got {svc_resp.status_code}: {svc_resp.text}"
            )

            # Verify no service was created
            list_resp = integration_client.get(
                f"/api/v1/merchants/{created_merchant_id}/services",
                headers=test_user["auth_headers"],
            )
            assert list_resp.status_code == 200
            services = list_resp.json()
            injected = [s for s in services if s["name"] == "Injected Service"]
            assert injected == [], "No injected service should exist on user A's merchant"
        finally:
            if created_merchant_id:
                delete_merchant(created_merchant_id)

    def test_user_cannot_delete_others_portfolio_image(
        self, integration_client, test_user, test_user_b
    ):
        """User B sends DELETE portfolio image on user A's merchant — must get 403 or 404."""
        created_merchant_id = None
        portfolio_img_id = None
        try:
            # User A creates a merchant
            create_resp = integration_client.post(
                "/api/v1/merchants",
                json=make_merchant_payload(),
                headers=test_user["auth_headers"],
            )
            assert create_resp.status_code == 201
            created_merchant_id = create_resp.json()["id"]

            # User A adds a portfolio image
            img_resp = integration_client.post(
                f"/api/v1/merchants/{created_merchant_id}/portfolio",
                json={"image_url": "https://example.com/portfolio.jpg"},
                headers=test_user["auth_headers"],
            )
            assert img_resp.status_code == 201
            portfolio_img_id = img_resp.json()["id"]

            # User B tries to delete user A's portfolio image
            del_resp = integration_client.delete(
                f"/api/v1/merchants/{created_merchant_id}/portfolio/{portfolio_img_id}",
                headers=test_user_b["auth_headers"],
            )
            assert del_resp.status_code in (403, 404), (
                f"Expected 403 or 404, got {del_resp.status_code}: {del_resp.text}"
            )

            # Verify portfolio image still exists
            portfolio_resp = integration_client.get(
                f"/api/v1/merchants/{created_merchant_id}/portfolio",
                headers=test_user["auth_headers"],
            )
            assert portfolio_resp.status_code == 200
            img_ids = [img["id"] for img in portfolio_resp.json()]
            assert portfolio_img_id in img_ids, (
                "Portfolio image should still exist after rejected delete by non-owner"
            )
        finally:
            if created_merchant_id:
                # Cascade deletes portfolio images as well
                delete_merchant(created_merchant_id)

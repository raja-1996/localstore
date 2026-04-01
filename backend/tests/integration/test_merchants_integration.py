"""
Integration tests for /api/v1/merchants, /services, and /portfolio endpoints.

Requires a running Supabase instance. Automatically skipped if unreachable.
All tests share session-scoped test_user and test_user_b fixtures from conftest.

Cleanup pattern: each test class that creates a merchant deletes it via admin
Supabase client in a finally block to avoid polluting subsequent tests.
"""
import re
import uuid

import pytest

from tests.integration.conftest import skip_if_no_supabase, make_merchant_payload, delete_merchant
from app.api.v1.portfolio import MAX_PORTFOLIO_IMAGES

pytestmark = skip_if_no_supabase


# Local aliases to preserve existing call-site names throughout this file
_make_merchant_payload = make_merchant_payload
_delete_merchant = delete_merchant


# ---------------------------------------------------------------------------
# TestCreateMerchantIntegration
# ---------------------------------------------------------------------------

class TestCreateMerchantIntegration:
    def test_create_merchant_success(self, integration_client, test_user):
        created_merchant_id = None
        try:
            payload = _make_merchant_payload()
            resp = integration_client.post(
                "/api/v1/merchants",
                json=payload,
                headers=test_user["auth_headers"],
            )
            assert resp.status_code == 201
            data = resp.json()
            assert data["name"] == payload["name"]
            assert data["is_active"] is True
            assert "id" in data
            assert data["category"] == payload["category"]
            assert data["description"] == payload["description"]
            created_merchant_id = data["id"]
        finally:
            if created_merchant_id:
                _delete_merchant(created_merchant_id)

    def test_create_merchant_duplicate_returns_409(self, integration_client, test_user):
        created_merchant_id = None
        try:
            payload = _make_merchant_payload()
            resp = integration_client.post(
                "/api/v1/merchants",
                json=payload,
                headers=test_user["auth_headers"],
            )
            assert resp.status_code == 201
            created_merchant_id = resp.json()["id"]

            # Second create with same user → 409
            resp2 = integration_client.post(
                "/api/v1/merchants",
                json=_make_merchant_payload(),
                headers=test_user["auth_headers"],
            )
            assert resp2.status_code == 409
        finally:
            if created_merchant_id:
                _delete_merchant(created_merchant_id)

    def test_create_merchant_sets_is_merchant_true(self, integration_client, test_user):
        created_merchant_id = None
        try:
            resp = integration_client.post(
                "/api/v1/merchants",
                json=_make_merchant_payload(),
                headers=test_user["auth_headers"],
            )
            assert resp.status_code == 201
            created_merchant_id = resp.json()["id"]

            profile_resp = integration_client.get(
                "/api/v1/users/me",
                headers=test_user["auth_headers"],
            )
            assert profile_resp.status_code == 200
            assert profile_resp.json()["is_merchant"] is True
        finally:
            if created_merchant_id:
                _delete_merchant(created_merchant_id)


# ---------------------------------------------------------------------------
# TestGetMerchantIntegration
# ---------------------------------------------------------------------------

class TestGetMerchantIntegration:
    def test_get_own_merchant(self, integration_client, test_user):
        created_merchant_id = None
        try:
            payload = _make_merchant_payload()
            create_resp = integration_client.post(
                "/api/v1/merchants",
                json=payload,
                headers=test_user["auth_headers"],
            )
            assert create_resp.status_code == 201
            created_merchant_id = create_resp.json()["id"]

            resp = integration_client.get(
                "/api/v1/merchants/me",
                headers=test_user["auth_headers"],
            )
            assert resp.status_code == 200
            assert resp.json()["name"] == payload["name"]
        finally:
            if created_merchant_id:
                _delete_merchant(created_merchant_id)

    def test_get_merchant_by_id(self, integration_client, test_user):
        created_merchant_id = None
        try:
            create_resp = integration_client.post(
                "/api/v1/merchants",
                json=_make_merchant_payload(),
                headers=test_user["auth_headers"],
            )
            assert create_resp.status_code == 201
            created_merchant_id = create_resp.json()["id"]

            resp = integration_client.get(
                f"/api/v1/merchants/{created_merchant_id}",
                headers=test_user["auth_headers"],
            )
            assert resp.status_code == 200
            assert resp.json()["id"] == created_merchant_id
        finally:
            if created_merchant_id:
                _delete_merchant(created_merchant_id)

    def test_get_merchant_phone_masked_for_non_owner(
        self, integration_client, test_user, test_user_b
    ):
        created_merchant_id = None
        try:
            create_resp = integration_client.post(
                "/api/v1/merchants",
                json=_make_merchant_payload(phone="+911234567890"),
                headers=test_user["auth_headers"],
            )
            assert create_resp.status_code == 201
            created_merchant_id = create_resp.json()["id"]

            # test_user_b fetches the merchant — phone must be masked
            resp = integration_client.get(
                f"/api/v1/merchants/{created_merchant_id}",
                headers=test_user_b["auth_headers"],
            )
            assert resp.status_code == 200
            phone = resp.json().get("phone", "")
            assert re.search(r'\*+', phone), f"Expected masked phone with asterisks, got: {phone!r}"
            assert not phone.startswith('+911234567890'), f"Phone should be masked, got: {phone!r}"
        finally:
            if created_merchant_id:
                _delete_merchant(created_merchant_id)


# ---------------------------------------------------------------------------
# TestUpdateMerchantIntegration
# ---------------------------------------------------------------------------

class TestUpdateMerchantIntegration:
    def test_update_merchant_name(self, integration_client, test_user):
        created_merchant_id = None
        try:
            create_resp = integration_client.post(
                "/api/v1/merchants",
                json=_make_merchant_payload(),
                headers=test_user["auth_headers"],
            )
            assert create_resp.status_code == 201
            created_merchant_id = create_resp.json()["id"]

            new_name = f"Updated Merchant {uuid.uuid4().hex[:6]}"
            patch_resp = integration_client.patch(
                f"/api/v1/merchants/{created_merchant_id}",
                json={"name": new_name},
                headers=test_user["auth_headers"],
            )
            assert patch_resp.status_code == 200

            # Verify the name was persisted
            me_resp = integration_client.get(
                "/api/v1/merchants/me",
                headers=test_user["auth_headers"],
            )
            assert me_resp.status_code == 200
            assert me_resp.json()["name"] == new_name
        finally:
            if created_merchant_id:
                _delete_merchant(created_merchant_id)

    def test_update_merchant_not_owner_returns_403(
        self, integration_client, test_user, test_user_b
    ):
        created_merchant_id = None
        try:
            create_resp = integration_client.post(
                "/api/v1/merchants",
                json=_make_merchant_payload(),
                headers=test_user["auth_headers"],
            )
            assert create_resp.status_code == 201
            created_merchant_id = create_resp.json()["id"]

            # test_user_b tries to patch test_user's merchant → 403
            patch_resp = integration_client.patch(
                f"/api/v1/merchants/{created_merchant_id}",
                json={"name": "Hijacked Name"},
                headers=test_user_b["auth_headers"],
            )
            assert patch_resp.status_code == 403
        finally:
            if created_merchant_id:
                _delete_merchant(created_merchant_id)


# ---------------------------------------------------------------------------
# TestDeleteMerchantIntegration
# ---------------------------------------------------------------------------

class TestDeleteMerchantIntegration:
    def test_delete_merchant_soft_deletes(self, integration_client, test_user, test_user_b):
        created_merchant_id = None
        try:
            create_resp = integration_client.post(
                "/api/v1/merchants",
                json=_make_merchant_payload(),
                headers=test_user["auth_headers"],
            )
            assert create_resp.status_code == 201
            created_merchant_id = create_resp.json()["id"]

            delete_resp = integration_client.delete(
                f"/api/v1/merchants/{created_merchant_id}",
                headers=test_user["auth_headers"],
            )
            assert delete_resp.status_code == 204

            # Row still accessible (SELECT policy = public)
            get_resp = integration_client.get(
                f"/api/v1/merchants/{created_merchant_id}",
                headers=test_user["auth_headers"],
            )
            assert get_resp.status_code == 200

            # Confirm is_active=False via admin read (bypasses RLS)
            from app.core.supabase import get_supabase
            admin_row = (
                get_supabase()
                .table("merchants")
                .select("is_active")
                .eq("id", created_merchant_id)
                .execute()
            )
            assert admin_row.data[0]["is_active"] is False

            # Verify other users can still see the soft-deleted merchant
            resp_b = integration_client.get(
                f"/api/v1/merchants/{created_merchant_id}",
                headers=test_user_b["auth_headers"],
            )
            assert resp_b.status_code == 200
        finally:
            if created_merchant_id:
                _delete_merchant(created_merchant_id)


# ---------------------------------------------------------------------------
# TestMerchantServicesIntegration
# ---------------------------------------------------------------------------

class TestMerchantServicesIntegration:
    def test_create_and_list_service(self, integration_client, test_user):
        created_merchant_id = None
        service_id = None
        try:
            create_resp = integration_client.post(
                "/api/v1/merchants",
                json=_make_merchant_payload(),
                headers=test_user["auth_headers"],
            )
            assert create_resp.status_code == 201
            created_merchant_id = create_resp.json()["id"]

            service_payload = {"name": "Haircut", "price": 150.0}
            svc_resp = integration_client.post(
                f"/api/v1/merchants/{created_merchant_id}/services",
                json=service_payload,
                headers=test_user["auth_headers"],
            )
            assert svc_resp.status_code == 201
            service_id = svc_resp.json()["id"]

            list_resp = integration_client.get(
                f"/api/v1/merchants/{created_merchant_id}/services",
                headers=test_user["auth_headers"],
            )
            assert list_resp.status_code == 200
            services = list_resp.json()
            service_ids = [s["id"] for s in services]
            assert service_id in service_ids

            # Verify merchant_id is correct
            service_obj = next((s for s in services if s["id"] == service_id), None)
            assert service_obj is not None
            assert service_obj["merchant_id"] == created_merchant_id
        finally:
            if created_merchant_id:
                # Cascade deletes services as well
                _delete_merchant(created_merchant_id)

                # Verify cascade deletion worked
                if service_id:
                    from app.core.supabase import get_supabase
                    rows = get_supabase().table('services').select('id').eq('id', service_id).execute()
                    assert rows.data == []


# ---------------------------------------------------------------------------
# TestMerchantPortfolioIntegration
# ---------------------------------------------------------------------------

class TestMerchantPortfolioIntegration:
    def test_add_portfolio_image(self, integration_client, test_user):
        created_merchant_id = None
        try:
            create_resp = integration_client.post(
                "/api/v1/merchants",
                json=_make_merchant_payload(),
                headers=test_user["auth_headers"],
            )
            assert create_resp.status_code == 201
            created_merchant_id = create_resp.json()["id"]

            img_resp = integration_client.post(
                f"/api/v1/merchants/{created_merchant_id}/portfolio",
                json={"image_url": "https://example.com/img.jpg"},
                headers=test_user["auth_headers"],
            )
            assert img_resp.status_code == 201
            assert img_resp.json()["image_url"] == "https://example.com/img.jpg"
        finally:
            if created_merchant_id:
                _delete_merchant(created_merchant_id)

    def test_portfolio_max_10(self, integration_client, test_user):
        created_merchant_id = None
        try:
            create_resp = integration_client.post(
                "/api/v1/merchants",
                json=_make_merchant_payload(),
                headers=test_user["auth_headers"],
            )
            assert create_resp.status_code == 201
            created_merchant_id = create_resp.json()["id"]

            # Add MAX_PORTFOLIO_IMAGES images — all must succeed
            for i in range(MAX_PORTFOLIO_IMAGES):
                resp = integration_client.post(
                    f"/api/v1/merchants/{created_merchant_id}/portfolio",
                    json={"image_url": f"https://example.com/img-{i}.jpg"},
                    headers=test_user["auth_headers"],
                )
                assert resp.status_code == 201, (
                    f"Expected 201 on image {i}, got {resp.status_code}: {resp.text}"
                )

            # (MAX_PORTFOLIO_IMAGES + 1)th image must be rejected with 400
            overflow_resp = integration_client.post(
                f"/api/v1/merchants/{created_merchant_id}/portfolio",
                json={"image_url": "https://example.com/overflow.jpg"},
                headers=test_user["auth_headers"],
            )
            assert overflow_resp.status_code == 400
        finally:
            if created_merchant_id:
                _delete_merchant(created_merchant_id)


# ---------------------------------------------------------------------------
# TestMerchantEndpointsIntegration — S4-T1
# ---------------------------------------------------------------------------

class TestMerchantEndpointsIntegration:
    """S4-T1: Merchant detail, services list, portfolio ordering, category filter."""

    def test_get_merchant_by_id_returns_detail(self, integration_client, test_user):
        """POST a merchant, GET by id, verify all key MerchantDetail fields present."""
        created_merchant_id = None
        try:
            payload = _make_merchant_payload()
            create_resp = integration_client.post(
                "/api/v1/merchants",
                json=payload,
                headers=test_user["auth_headers"],
            )
            assert create_resp.status_code == 201
            created_merchant_id = create_resp.json()["id"]

            resp = integration_client.get(
                f"/api/v1/merchants/{created_merchant_id}",
                headers=test_user["auth_headers"],
            )
            assert resp.status_code == 200
            data = resp.json()
            assert data["id"] == created_merchant_id
            assert data["name"] == payload["name"]
            assert data["category"] == payload["category"]
            assert "is_active" in data
            assert data["is_active"] is True
        finally:
            if created_merchant_id:
                _delete_merchant(created_merchant_id)

    def test_get_merchant_services_returns_list(self, integration_client, test_user):
        """POST merchant + POST service, GET services list, verify service fields."""
        created_merchant_id = None
        try:
            create_resp = integration_client.post(
                "/api/v1/merchants",
                json=_make_merchant_payload(),
                headers=test_user["auth_headers"],
            )
            assert create_resp.status_code == 201
            created_merchant_id = create_resp.json()["id"]

            svc_payload = {"name": "Deep Cleanse Facial", "price": 499.0}
            svc_resp = integration_client.post(
                f"/api/v1/merchants/{created_merchant_id}/services",
                json=svc_payload,
                headers=test_user["auth_headers"],
            )
            assert svc_resp.status_code == 201
            service_id = svc_resp.json()["id"]

            list_resp = integration_client.get(
                f"/api/v1/merchants/{created_merchant_id}/services",
                headers=test_user["auth_headers"],
            )
            assert list_resp.status_code == 200
            services = list_resp.json()
            assert isinstance(services, list)
            assert len(services) >= 1

            target = next((s for s in services if s["id"] == service_id), None)
            assert target is not None
            assert target["merchant_id"] == created_merchant_id
            assert target["name"] == svc_payload["name"]
            assert float(target["price"]) == svc_payload["price"]
        finally:
            if created_merchant_id:
                # Cascade deletes services
                _delete_merchant(created_merchant_id)

    def test_get_merchant_portfolio_returns_ordered(self, integration_client, test_user):
        """POST 2 portfolio images with different sort_orders, GET portfolio, verify ascending order."""
        created_merchant_id = None
        try:
            create_resp = integration_client.post(
                "/api/v1/merchants",
                json=_make_merchant_payload(),
                headers=test_user["auth_headers"],
            )
            assert create_resp.status_code == 201
            created_merchant_id = create_resp.json()["id"]

            # Add image with sort_order=5 first
            resp_high = integration_client.post(
                f"/api/v1/merchants/{created_merchant_id}/portfolio",
                json={"image_url": "https://example.com/high.jpg", "sort_order": 5},
                headers=test_user["auth_headers"],
            )
            assert resp_high.status_code == 201

            # Add image with sort_order=1 second
            resp_low = integration_client.post(
                f"/api/v1/merchants/{created_merchant_id}/portfolio",
                json={"image_url": "https://example.com/low.jpg", "sort_order": 1},
                headers=test_user["auth_headers"],
            )
            assert resp_low.status_code == 201

            portfolio_resp = integration_client.get(
                f"/api/v1/merchants/{created_merchant_id}/portfolio",
                headers=test_user["auth_headers"],
            )
            assert portfolio_resp.status_code == 200
            images = portfolio_resp.json()
            assert len(images) == 2

            # Verify ascending sort_order
            sort_orders = [img["sort_order"] for img in images]
            assert sort_orders == sorted(sort_orders), (
                f"Portfolio images not sorted by sort_order ascending: {sort_orders}"
            )
            assert sort_orders[0] == 1
            assert sort_orders[1] == 5
        finally:
            if created_merchant_id:
                _delete_merchant(created_merchant_id)

    def test_get_merchants_category_filter(
        self, integration_client, test_user
    ):
        """POST a Beauty merchant for test_user, GET with category=Beauty, verify all results are Beauty."""
        beauty_id = None
        try:
            beauty_resp = integration_client.post(
                "/api/v1/merchants",
                json=_make_merchant_payload(
                    name=f"Beauty Place {uuid.uuid4().hex[:6]}",
                    category="Beauty",
                ),
                headers=test_user["auth_headers"],
            )
            assert beauty_resp.status_code == 201
            beauty_id = beauty_resp.json()["id"]

            list_resp = integration_client.get(
                "/api/v1/merchants",
                params={
                    "lat": 12.9716,
                    "lng": 77.5946,
                    "category": "Beauty",
                },
                headers=test_user["auth_headers"],
            )
            assert list_resp.status_code == 200
            merchants = list_resp.json()

            # The Beauty merchant we just created must appear in results
            returned_ids = [m["id"] for m in merchants]
            assert beauty_id in returned_ids
            # Category filter must exclude non-Beauty merchants — every result must be Beauty
            assert all(m["category"] == "Beauty" for m in merchants)
        finally:
            if beauty_id:
                _delete_merchant(beauty_id)

    def test_get_merchant_detail_includes_all_fields(
        self, integration_client, test_user
    ):
        """POST merchant with description + neighborhood, GET by id, verify those fields."""
        created_merchant_id = None
        try:
            payload = _make_merchant_payload(
                description="Award-winning beauty salon in Koramangala",
                neighborhood="Koramangala",
            )
            create_resp = integration_client.post(
                "/api/v1/merchants",
                json=payload,
                headers=test_user["auth_headers"],
            )
            assert create_resp.status_code == 201
            created_merchant_id = create_resp.json()["id"]

            resp = integration_client.get(
                f"/api/v1/merchants/{created_merchant_id}",
                headers=test_user["auth_headers"],
            )
            assert resp.status_code == 200
            data = resp.json()

            assert data["description"] == payload["description"]
            assert data["neighborhood"] == payload["neighborhood"]
            # Verify all MerchantDetail fields are present in the response
            for field in ("id", "name", "category", "is_active", "created_at",
                          "service_radius_meters", "avg_rating", "review_count",
                          "follower_count", "is_verified"):
                assert field in data, f"Expected field '{field}' missing from response"
        finally:
            if created_merchant_id:
                _delete_merchant(created_merchant_id)

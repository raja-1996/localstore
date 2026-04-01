"""
Integration tests for GET /feed/nearby.

Requires a running Supabase with PostGIS enabled and migration
009_feed_search_rpc.sql applied.

Verifies:
- Nearer merchant ranked first (S3-T2)
- Category filter excludes other categories (S3-T2)
- is_active=false merchants excluded from feed (S3-T2)
- Cursor pagination returns disjoint pages (S3-T4)
"""
import uuid

import pytest

from tests.integration.conftest import skip_if_no_supabase

pytestmark = skip_if_no_supabase


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_merchant_payload(**overrides):
    base = {
        "name": f"Feed Test {uuid.uuid4().hex[:6]}",
        "category": "Beauty",
        "lat": 17.385,
        "lng": 78.4867,
        "description": "Feed integration test merchant",
        "service_radius_meters": 5000,
    }
    base.update(overrides)
    return base


def _delete_merchant(merchant_id: str) -> None:
    from supabase import create_client
    from app.core.config import settings
    try:
        client = create_client(settings.supabase_url, settings.supabase_secret_default_key)
        client.table("merchants").delete().eq("id", merchant_id).execute()
    except Exception as e:
        print(f"Warning: _delete_merchant failed for {merchant_id}: {e}")


# ---------------------------------------------------------------------------
# TestFeedNearbyIntegration — S3-T2
# ---------------------------------------------------------------------------

class TestFeedNearbyIntegration:
    def test_nearer_merchant_ranked_first(self, integration_client, test_user, test_user_b):
        """Two merchants at different distances; nearer one should appear first."""
        near_id = None
        far_id = None
        try:
            # Create near merchant (user A) at Banjara Hills
            near_resp = integration_client.post(
                "/api/v1/merchants",
                json=_make_merchant_payload(
                    name=f"Near Merchant {uuid.uuid4().hex[:6]}",
                    lat=17.385,
                    lng=78.4867,
                ),
                headers=test_user["auth_headers"],
            )
            assert near_resp.status_code == 201
            near_id = near_resp.json()["id"]

            # Create far merchant (user B) at ~10 km away
            far_resp = integration_client.post(
                "/api/v1/merchants",
                json=_make_merchant_payload(
                    name=f"Far Merchant {uuid.uuid4().hex[:6]}",
                    lat=17.45,
                    lng=78.55,
                ),
                headers=test_user_b["auth_headers"],
            )
            assert far_resp.status_code == 201
            far_id = far_resp.json()["id"]

            # Query nearby from Banjara Hills centre with large radius
            feed_resp = integration_client.get(
                "/api/v1/feed/nearby",
                params={"lat": 17.385, "lng": 78.4867, "radius": 20000},
                headers=test_user["auth_headers"],
            )
            assert feed_resp.status_code == 200
            data = feed_resp.json()
            ids = [item["id"] for item in data["data"]]

            assert near_id in ids
            assert far_id in ids

            # Nearer merchant must appear before the farther one
            assert ids.index(near_id) < ids.index(far_id)

            # Distance values must be consistent
            near_item = next(i for i in data["data"] if i["id"] == near_id)
            far_item = next(i for i in data["data"] if i["id"] == far_id)
            assert near_item["distance_meters"] < far_item["distance_meters"]
            # Near merchant is seeded at the query point — distance should be < 100 m
            assert near_item["distance_meters"] < 100
        finally:
            if near_id:
                _delete_merchant(near_id)
            if far_id:
                _delete_merchant(far_id)

    def test_category_filter_excludes_other_categories(
        self, integration_client, test_user, test_user_b
    ):
        """Only Beauty merchants returned when category=Beauty is set."""
        beauty_id = None
        food_id = None
        try:
            beauty_resp = integration_client.post(
                "/api/v1/merchants",
                json=_make_merchant_payload(
                    name=f"Beauty Shop {uuid.uuid4().hex[:6]}",
                    category="Beauty",
                ),
                headers=test_user["auth_headers"],
            )
            assert beauty_resp.status_code == 201
            beauty_id = beauty_resp.json()["id"]

            food_resp = integration_client.post(
                "/api/v1/merchants",
                json=_make_merchant_payload(
                    name=f"Food Place {uuid.uuid4().hex[:6]}",
                    category="Food",
                ),
                headers=test_user_b["auth_headers"],
            )
            assert food_resp.status_code == 201
            food_id = food_resp.json()["id"]

            feed_resp = integration_client.get(
                "/api/v1/feed/nearby",
                params={
                    "lat": 17.385,
                    "lng": 78.4867,
                    "radius": 20000,
                    "category": "Beauty",
                },
                headers=test_user["auth_headers"],
            )
            assert feed_resp.status_code == 200
            data = feed_resp.json()
            ids = [item["id"] for item in data["data"]]

            assert beauty_id in ids
            assert food_id not in ids
            # Every returned item must be Beauty
            assert all(item["category"] == "Beauty" for item in data["data"])
        finally:
            if beauty_id:
                _delete_merchant(beauty_id)
            if food_id:
                _delete_merchant(food_id)

    def test_inactive_merchant_excluded(self, integration_client, test_user):
        """Soft-deleted (is_active=false) merchant must not appear in feed."""
        merchant_id = None
        try:
            create_resp = integration_client.post(
                "/api/v1/merchants",
                json=_make_merchant_payload(),
                headers=test_user["auth_headers"],
            )
            assert create_resp.status_code == 201
            merchant_id = create_resp.json()["id"]

            # Soft-delete via DELETE endpoint
            delete_resp = integration_client.delete(
                f"/api/v1/merchants/{merchant_id}",
                headers=test_user["auth_headers"],
            )
            assert delete_resp.status_code == 204

            # Feed must not include the inactive merchant
            feed_resp = integration_client.get(
                "/api/v1/feed/nearby",
                params={"lat": 17.385, "lng": 78.4867, "radius": 20000},
                headers=test_user["auth_headers"],
            )
            assert feed_resp.status_code == 200
            ids = [item["id"] for item in feed_resp.json()["data"]]
            assert merchant_id not in ids
        finally:
            if merchant_id:
                _delete_merchant(merchant_id)


# ---------------------------------------------------------------------------
# TestCursorPaginationIntegration — S3-T4
# ---------------------------------------------------------------------------

class TestCursorPaginationIntegration:
    """S3-T4: Cursor pagination returns disjoint pages."""

    def test_pages_are_disjoint(self, integration_client, test_user, test_user_b):
        """Seed merchants, paginate with limit=1, verify page 1 and page 2 are disjoint."""
        created_ids = []
        try:
            # Create first merchant under test_user (409 if already exists — that is fine)
            resp1 = integration_client.post(
                "/api/v1/merchants",
                json=_make_merchant_payload(
                    name=f"Page Test A {uuid.uuid4().hex[:6]}",
                    lat=17.385,
                    lng=78.4867,
                ),
                headers=test_user["auth_headers"],
            )
            if resp1.status_code == 201:
                created_ids.append(resp1.json()["id"])

            # Create second merchant under test_user_b
            resp2 = integration_client.post(
                "/api/v1/merchants",
                json=_make_merchant_payload(
                    name=f"Page Test B {uuid.uuid4().hex[:6]}",
                    lat=17.386,
                    lng=78.487,
                ),
                headers=test_user_b["auth_headers"],
            )
            if resp2.status_code == 201:
                created_ids.append(resp2.json()["id"])

            # Page 1: limit=1
            feed_resp1 = integration_client.get(
                "/api/v1/feed/nearby",
                params={"lat": 17.385, "lng": 78.4867, "radius": 20000, "limit": 1},
                headers=test_user["auth_headers"],
            )
            assert feed_resp1.status_code == 200
            page1 = feed_resp1.json()
            page1_ids = {item["id"] for item in page1["data"]}

            if not page1["has_more"]:
                pytest.skip("Not enough merchants in radius for pagination test")

            # Page 2: use cursor from page 1
            feed_resp2 = integration_client.get(
                "/api/v1/feed/nearby",
                params={
                    "lat": 17.385,
                    "lng": 78.4867,
                    "radius": 20000,
                    "limit": 1,
                    "before": page1["next_cursor"],
                },
                headers=test_user["auth_headers"],
            )
            assert feed_resp2.status_code == 200
            page2 = feed_resp2.json()
            page2_ids = {item["id"] for item in page2["data"]}

            # Pages must not share any IDs
            assert page1_ids.isdisjoint(page2_ids), (
                f"Page overlap detected: {page1_ids & page2_ids}"
            )
        finally:
            for mid in created_ids:
                _delete_merchant(mid)

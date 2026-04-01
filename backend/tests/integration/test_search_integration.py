"""
Integration tests for GET /search.

Requires a running Supabase with pg_trgm and tsvector indexes enabled
and migration 009_feed_search_rpc.sql applied.

Verifies (S3-T3):
- Search finds a merchant by its unique name
- Search finds a service by its unique name
- Empty query returns 422
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
        "name": f"Search Test {uuid.uuid4().hex[:6]}",
        "category": "Beauty",
        "lat": 17.385,
        "lng": 78.4867,
        "description": "Search integration test",
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
# TestSearchIntegration — S3-T3
# ---------------------------------------------------------------------------

class TestSearchIntegration:
    def test_search_finds_merchant_by_name(self, integration_client, test_user):
        """Seed a merchant with a unique name token; exact search must find it."""
        merchant_id = None
        unique = uuid.uuid4().hex[:6]
        merchant_name = f"BeautyQueen{unique}"
        try:
            create_resp = integration_client.post(
                "/api/v1/merchants",
                json=_make_merchant_payload(name=merchant_name),
                headers=test_user["auth_headers"],
            )
            assert create_resp.status_code == 201
            merchant_id = create_resp.json()["id"]

            search_resp = integration_client.get(
                "/api/v1/search",
                params={
                    "q": merchant_name,
                    "lat": 17.385,
                    "lng": 78.4867,
                },
                headers=test_user["auth_headers"],
            )
            assert search_resp.status_code == 200
            data = search_resp.json()
            merchant_ids = [m["id"] for m in data["merchants"]]
            assert merchant_id in merchant_ids, (
                f"Expected {merchant_id} in merchant results, got: {merchant_ids}"
            )
        finally:
            if merchant_id:
                _delete_merchant(merchant_id)

    def test_search_finds_service_by_name(self, integration_client, test_user):
        """Seed a merchant and a service with a unique service name; search for it."""
        merchant_id = None
        unique = uuid.uuid4().hex[:6]
        service_name = f"BridalMehendi{unique}"
        try:
            create_resp = integration_client.post(
                "/api/v1/merchants",
                json=_make_merchant_payload(name=f"ServiceSearch{unique}"),
                headers=test_user["auth_headers"],
            )
            assert create_resp.status_code == 201
            merchant_id = create_resp.json()["id"]

            svc_resp = integration_client.post(
                f"/api/v1/merchants/{merchant_id}/services",
                json={"name": service_name, "price": 2000.0},
                headers=test_user["auth_headers"],
            )
            assert svc_resp.status_code == 201

            search_resp = integration_client.get(
                "/api/v1/search",
                params={"q": service_name},
                headers=test_user["auth_headers"],
            )
            assert search_resp.status_code == 200
            data = search_resp.json()
            service_names = [s["name"] for s in data["services"]]
            assert service_name in service_names, (
                f"Expected service '{service_name}' in results, got: {service_names}"
            )
        finally:
            if merchant_id:
                # Cascade delete removes services too
                _delete_merchant(merchant_id)

    def test_search_empty_query_returns_422(self, integration_client, test_user):
        """Empty q parameter must be rejected with 422."""
        resp = integration_client.get(
            "/api/v1/search",
            params={"q": ""},
            headers=test_user["auth_headers"],
        )
        assert resp.status_code == 422

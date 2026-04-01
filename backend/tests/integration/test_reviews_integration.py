"""
Integration tests for avg_rating trigger, RLS self-review block, and
duplicate constraint (S7-T2, S7-T3).

Requires a running Supabase instance. Automatically skipped if unreachable.
All tests share session-scoped fixtures from conftest.
Each test creates and cleans up its own data; no shared state across tests.
"""
import pytest

from tests.integration.conftest import (
    skip_if_no_supabase,
    make_merchant_payload,
    delete_merchant,
)

pytestmark = skip_if_no_supabase


def _get_service_client():
    """Return a new service-role Supabase client (bypasses RLS)."""
    from supabase import create_client
    from app.core.config import settings
    return create_client(settings.supabase_url, settings.supabase_secret_default_key)


def _make_temp_user(integration_client, prefix: str) -> dict:
    """Create a throwaway test user and return the user-info dict."""
    from tests.integration.conftest import _create_test_user
    return _create_test_user(integration_client, prefix)


def _delete_temp_user(user_id: str) -> None:
    """Delete a throwaway test user via the admin API."""
    from app.core.supabase import get_supabase
    try:
        get_supabase().auth.admin.delete_user(user_id)
    except Exception as e:
        print(f"Warning: could not delete temp user {user_id}: {e}")


def _get_avg_rating(merchant_id: str) -> float:
    """Read avg_rating via service-role client (bypasses RLS)."""
    client = _get_service_client()
    result = (
        client.table("merchants")
        .select("avg_rating")
        .eq("id", merchant_id)
        .execute()
    )
    raw = result.data[0]["avg_rating"] if result.data else None
    return float(raw) if raw is not None else 0.0


def _delete_review(review_id: str) -> None:
    """Hard-delete a review row via service-role client (bypasses RLS)."""
    try:
        client = _get_service_client()
        client.table("reviews").delete().eq("id", review_id).execute()
    except Exception as e:
        print(f"Warning: _delete_review failed for {review_id}: {e}")


# ---------------------------------------------------------------------------
# TestAvgRatingTrigger (S7-T2)
# ---------------------------------------------------------------------------

class TestAvgRatingTrigger:
    def test_avg_rating_after_single_review(
        self, integration_client, test_user, test_user_b
    ):
        """POST review rating=4 by test_user_b → avg_rating on merchant == 4.0."""
        merchant_id = None
        review_id = None
        try:
            # test_user creates the merchant
            create_resp = integration_client.post(
                "/api/v1/merchants",
                json=make_merchant_payload(),
                headers=test_user["auth_headers"],
            )
            assert create_resp.status_code == 201
            merchant_id = create_resp.json()["id"]

            # test_user_b posts a review with rating=4
            review_resp = integration_client.post(
                f"/api/v1/merchants/{merchant_id}/reviews",
                json={"rating": 4, "body": "Good service"},
                headers=test_user_b["auth_headers"],
            )
            assert review_resp.status_code == 201
            review_id = review_resp.json()["id"]

            # Verify avg_rating via direct DB query
            avg = _get_avg_rating(merchant_id)
            assert avg == 4.0, f"Expected avg_rating=4.0, got {avg}"
        finally:
            if review_id:
                _delete_review(review_id)
            if merchant_id:
                delete_merchant(merchant_id)

    def test_avg_rating_after_two_reviews(
        self, integration_client, test_user, test_user_b
    ):
        """rating=4 then rating=5 (different user) → avg_rating == 4.50."""
        merchant_id = None
        review_b_id = None
        review_c_id = None
        third_user_id = None
        try:
            # test_user creates the merchant
            create_resp = integration_client.post(
                "/api/v1/merchants",
                json=make_merchant_payload(),
                headers=test_user["auth_headers"],
            )
            assert create_resp.status_code == 201
            merchant_id = create_resp.json()["id"]

            # test_user_b posts first review with rating=4
            resp_b = integration_client.post(
                f"/api/v1/merchants/{merchant_id}/reviews",
                json={"rating": 4, "body": "Pretty good"},
                headers=test_user_b["auth_headers"],
            )
            assert resp_b.status_code == 201
            review_b_id = resp_b.json()["id"]

            # Create a third user inline for the second review
            third_user = _make_temp_user(integration_client, "integration-test-c")
            third_user_id = third_user["user_id"]

            # Third user posts second review with rating=5
            resp_c = integration_client.post(
                f"/api/v1/merchants/{merchant_id}/reviews",
                json={"rating": 5, "body": "Excellent"},
                headers=third_user["auth_headers"],
            )
            assert resp_c.status_code == 201
            review_c_id = resp_c.json()["id"]

            # Verify avg_rating == 4.50 via direct DB query
            avg = _get_avg_rating(merchant_id)
            assert avg == pytest.approx(4.50, abs=0.01), (
                f"Expected avg_rating=4.50, got {avg}"
            )
        finally:
            if review_b_id:
                _delete_review(review_b_id)
            if review_c_id:
                _delete_review(review_c_id)
            if third_user_id:
                _delete_temp_user(third_user_id)
            if merchant_id:
                delete_merchant(merchant_id)

    def test_avg_rating_after_delete(
        self, integration_client, test_user, test_user_b
    ):
        """POST rating=4, POST rating=5, DELETE rating=4 → avg_rating == 5.0."""
        merchant_id = None
        review_b_id = None
        review_c_id = None
        third_user_id = None
        try:
            # test_user creates the merchant
            create_resp = integration_client.post(
                "/api/v1/merchants",
                json=make_merchant_payload(),
                headers=test_user["auth_headers"],
            )
            assert create_resp.status_code == 201
            merchant_id = create_resp.json()["id"]

            # test_user_b posts first review with rating=4
            resp_b = integration_client.post(
                f"/api/v1/merchants/{merchant_id}/reviews",
                json={"rating": 4, "body": "Good"},
                headers=test_user_b["auth_headers"],
            )
            assert resp_b.status_code == 201
            review_b_id = resp_b.json()["id"]

            # Create a third user inline for the second review
            third_user = _make_temp_user(integration_client, "integration-test-d")
            third_user_id = third_user["user_id"]

            # Third user posts second review with rating=5
            resp_c = integration_client.post(
                f"/api/v1/merchants/{merchant_id}/reviews",
                json={"rating": 5, "body": "Excellent"},
                headers=third_user["auth_headers"],
            )
            assert resp_c.status_code == 201
            review_c_id = resp_c.json()["id"]

            # Confirm avg before delete
            avg_before = _get_avg_rating(merchant_id)
            assert avg_before == pytest.approx(4.50, abs=0.01), (
                f"Expected avg_rating=4.50 before delete, got {avg_before}"
            )

            # test_user_b deletes their own review (rating=4)
            del_resp = integration_client.delete(
                f"/api/v1/merchants/{merchant_id}/reviews/{review_b_id}",
                headers=test_user_b["auth_headers"],
            )
            assert del_resp.status_code == 204
            review_b_id = None  # already deleted; skip cleanup

            # Verify avg_rating == 5.0 via direct DB query
            avg_after = _get_avg_rating(merchant_id)
            assert avg_after == pytest.approx(5.0, abs=0.01), (
                f"Expected avg_rating=5.0 after delete, got {avg_after}"
            )
        finally:
            if review_b_id:
                _delete_review(review_b_id)
            if review_c_id:
                _delete_review(review_c_id)
            if third_user_id:
                _delete_temp_user(third_user_id)
            if merchant_id:
                delete_merchant(merchant_id)


# ---------------------------------------------------------------------------
# TestSelfReviewRLS (S7-T3 — RLS self-review block)
# ---------------------------------------------------------------------------

class TestSelfReviewRLS:
    def test_self_review_blocked(
        self, integration_client, test_user
    ):
        """Merchant owner tries to review own merchant → 403."""
        merchant_id = None
        try:
            # test_user creates the merchant
            create_resp = integration_client.post(
                "/api/v1/merchants",
                json=make_merchant_payload(),
                headers=test_user["auth_headers"],
            )
            assert create_resp.status_code == 201
            merchant_id = create_resp.json()["id"]

            # test_user (owner) attempts to review their own merchant
            review_resp = integration_client.post(
                f"/api/v1/merchants/{merchant_id}/reviews",
                json={"rating": 5, "body": "My own shop is great"},
                headers=test_user["auth_headers"],
            )
            assert review_resp.status_code == 403, (
                f"Expected 403 for self-review, got {review_resp.status_code}"
            )
        finally:
            if merchant_id:
                delete_merchant(merchant_id)

    def test_non_owner_can_review(
        self, integration_client, test_user, test_user_b
    ):
        """Non-owner posts review → 201."""
        merchant_id = None
        review_id = None
        try:
            # test_user creates the merchant
            create_resp = integration_client.post(
                "/api/v1/merchants",
                json=make_merchant_payload(),
                headers=test_user["auth_headers"],
            )
            assert create_resp.status_code == 201
            merchant_id = create_resp.json()["id"]

            # test_user_b (non-owner) posts a review
            review_resp = integration_client.post(
                f"/api/v1/merchants/{merchant_id}/reviews",
                json={"rating": 3, "body": "Decent"},
                headers=test_user_b["auth_headers"],
            )
            assert review_resp.status_code == 201
            body = review_resp.json()
            assert body["rating"] == 3
            assert body["body"] == "Decent"
            review_id = body["id"]
        finally:
            if review_id:
                _delete_review(review_id)
            if merchant_id:
                delete_merchant(merchant_id)


# ---------------------------------------------------------------------------
# TestDuplicateReview (S7-T3 — duplicate constraint)
# ---------------------------------------------------------------------------

class TestDuplicateReview:
    def test_duplicate_review_409(
        self, integration_client, test_user, test_user_b
    ):
        """Same user reviews same merchant twice → second POST returns 409."""
        merchant_id = None
        review_id = None
        try:
            # test_user creates the merchant
            create_resp = integration_client.post(
                "/api/v1/merchants",
                json=make_merchant_payload(),
                headers=test_user["auth_headers"],
            )
            assert create_resp.status_code == 201
            merchant_id = create_resp.json()["id"]

            # test_user_b posts first review — must succeed
            resp1 = integration_client.post(
                f"/api/v1/merchants/{merchant_id}/reviews",
                json={"rating": 4, "body": "First review"},
                headers=test_user_b["auth_headers"],
            )
            assert resp1.status_code == 201
            review_id = resp1.json()["id"]

            # test_user_b posts second review on same merchant — must fail
            resp2 = integration_client.post(
                f"/api/v1/merchants/{merchant_id}/reviews",
                json={"rating": 5, "body": "Second attempt"},
                headers=test_user_b["auth_headers"],
            )
            assert resp2.status_code == 409, (
                f"Expected 409 on duplicate review, got {resp2.status_code}"
            )
            assert "already" in resp2.json()["detail"].lower()
        finally:
            if review_id:
                _delete_review(review_id)
            if merchant_id:
                delete_merchant(merchant_id)


# ---------------------------------------------------------------------------
# TestReviewOwnership (S7-T3 — PATCH/DELETE by non-owner → 403)
# ---------------------------------------------------------------------------

class TestReviewOwnership:
    def test_patch_review_by_non_owner_403(
        self, integration_client, test_user, test_user_b
    ):
        """PATCH review by a user who did not write it → 403."""
        merchant_id = None
        review_id = None
        try:
            # test_user_b creates the merchant; test_user writes a review
            create_resp = integration_client.post(
                "/api/v1/merchants",
                json=make_merchant_payload(),
                headers=test_user_b["auth_headers"],
            )
            assert create_resp.status_code == 201
            merchant_id = create_resp.json()["id"]

            # test_user (non-owner of the merchant, but reviewer) writes a review
            review_resp = integration_client.post(
                f"/api/v1/merchants/{merchant_id}/reviews",
                json={"rating": 3, "body": "Okay"},
                headers=test_user["auth_headers"],
            )
            assert review_resp.status_code == 201
            review_id = review_resp.json()["id"]

            # test_user_b (the merchant owner, NOT the reviewer) tries to PATCH the review
            patch_resp = integration_client.patch(
                f"/api/v1/merchants/{merchant_id}/reviews/{review_id}",
                json={"rating": 1},
                headers=test_user_b["auth_headers"],
            )
            assert patch_resp.status_code == 403, (
                f"Expected 403 for non-owner PATCH, got {patch_resp.status_code}"
            )
        finally:
            if review_id:
                _delete_review(review_id)
            if merchant_id:
                delete_merchant(merchant_id)

    def test_delete_review_by_non_owner_403(
        self, integration_client, test_user, test_user_b
    ):
        """DELETE review by a user who did not write it → 403."""
        merchant_id = None
        review_id = None
        try:
            # test_user_b creates the merchant; test_user writes a review
            create_resp = integration_client.post(
                "/api/v1/merchants",
                json=make_merchant_payload(),
                headers=test_user_b["auth_headers"],
            )
            assert create_resp.status_code == 201
            merchant_id = create_resp.json()["id"]

            # test_user (non-owner of the merchant) writes a review
            review_resp = integration_client.post(
                f"/api/v1/merchants/{merchant_id}/reviews",
                json={"rating": 4, "body": "Nice"},
                headers=test_user["auth_headers"],
            )
            assert review_resp.status_code == 201
            review_id = review_resp.json()["id"]

            # test_user_b (merchant owner, NOT the reviewer) tries to DELETE the review
            del_resp = integration_client.delete(
                f"/api/v1/merchants/{merchant_id}/reviews/{review_id}",
                headers=test_user_b["auth_headers"],
            )
            assert del_resp.status_code == 403, (
                f"Expected 403 for non-owner DELETE, got {del_resp.status_code}"
            )
        finally:
            if review_id:
                _delete_review(review_id)
            if merchant_id:
                delete_merchant(merchant_id)

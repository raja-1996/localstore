"""
Integration tests for follow/unfollow, follower_count trigger, and following feed (S6-T2).

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
    """Return a single service-role Supabase client (cached per module)."""
    from supabase import create_client
    from app.core.config import settings
    return create_client(settings.supabase_url, settings.supabase_secret_default_key)


def _delete_follow(follower_id: str, merchant_id: str) -> None:
    """Hard-delete a follow row via service-role client (bypasses RLS)."""
    try:
        client = _get_service_client()
        client.table("follows").delete().eq("follower_id", follower_id).eq("merchant_id", merchant_id).execute()
    except Exception as e:
        print(f"Warning: _delete_follow failed for {follower_id}/{merchant_id}: {e}")


def _delete_post(post_id: str) -> None:
    """Hard-delete a post row via service-role client."""
    try:
        client = _get_service_client()
        client.table("posts").delete().eq("id", post_id).execute()
    except Exception as e:
        print(f"Warning: _delete_post failed for {post_id}: {e}")


def _get_follower_count(merchant_id: str) -> int:
    """Read follower_count via service-role client (bypasses RLS)."""
    client = _get_service_client()
    result = client.table("merchants").select("follower_count").eq("id", merchant_id).execute()
    return result.data[0]["follower_count"] if result.data else 0


def _insert_post(merchant_id: str, content: str, is_active: bool = True) -> str:
    """Insert a post row directly via service-role client; return post id."""
    client = _get_service_client()
    result = client.table("posts").insert({
        "merchant_id": merchant_id,
        "content": content,
        "post_type": "update",
        "is_active": is_active,
    }).execute()
    return result.data[0]["id"]


# ---------------------------------------------------------------------------
# TestFollowerCountTrigger
# ---------------------------------------------------------------------------

class TestFollowerCountTrigger:
    def test_follow_increments_follower_count(
        self, integration_client, test_user, test_user_b
    ):
        """Follow a merchant → follower_count increments to 1."""
        merchant_id = None
        try:
            # test_user creates a merchant; test_user_b follows it
            create_resp = integration_client.post(
                "/api/v1/merchants",
                json=make_merchant_payload(),
                headers=test_user["auth_headers"],
            )
            assert create_resp.status_code == 201
            merchant_id = create_resp.json()["id"]

            count_before = _get_follower_count(merchant_id)
            assert count_before == 0

            follow_resp = integration_client.post(
                f"/api/v1/merchants/{merchant_id}/follow",
                headers=test_user_b["auth_headers"],
            )
            assert follow_resp.status_code == 201
            assert follow_resp.json()["merchant_id"] == merchant_id

            count_after = _get_follower_count(merchant_id)
            assert count_after == count_before + 1
        finally:
            if merchant_id:
                _delete_follow(test_user_b["user_id"], merchant_id)
                delete_merchant(merchant_id)

    def test_unfollow_decrements_follower_count(
        self, integration_client, test_user, test_user_b
    ):
        """Follow then unfollow → follower_count returns to 0."""
        merchant_id = None
        try:
            create_resp = integration_client.post(
                "/api/v1/merchants",
                json=make_merchant_payload(),
                headers=test_user["auth_headers"],
            )
            assert create_resp.status_code == 201
            merchant_id = create_resp.json()["id"]

            # Follow first
            follow_resp = integration_client.post(
                f"/api/v1/merchants/{merchant_id}/follow",
                headers=test_user_b["auth_headers"],
            )
            assert follow_resp.status_code == 201
            assert _get_follower_count(merchant_id) == 1

            # Unfollow
            unfollow_resp = integration_client.delete(
                f"/api/v1/merchants/{merchant_id}/follow",
                headers=test_user_b["auth_headers"],
            )
            assert unfollow_resp.status_code == 204
            assert _get_follower_count(merchant_id) == 0
        finally:
            # Cleanup: follow may already be deleted; best-effort
            if merchant_id:
                _delete_follow(test_user_b["user_id"], merchant_id)
                delete_merchant(merchant_id)

    def test_duplicate_follow_409(
        self, integration_client, test_user, test_user_b
    ):
        """Second follow by same user on same merchant returns 409."""
        merchant_id = None
        try:
            create_resp = integration_client.post(
                "/api/v1/merchants",
                json=make_merchant_payload(),
                headers=test_user["auth_headers"],
            )
            assert create_resp.status_code == 201
            merchant_id = create_resp.json()["id"]

            # First follow — must succeed
            resp1 = integration_client.post(
                f"/api/v1/merchants/{merchant_id}/follow",
                headers=test_user_b["auth_headers"],
            )
            assert resp1.status_code == 201

            # Second follow — must be rejected
            resp2 = integration_client.post(
                f"/api/v1/merchants/{merchant_id}/follow",
                headers=test_user_b["auth_headers"],
            )
            assert resp2.status_code == 409
            assert "already following" in resp2.json()["detail"].lower()

            # Verify follower_count is still 1 (not double-counted)
            assert _get_follower_count(merchant_id) == 1
        finally:
            if merchant_id:
                _delete_follow(test_user_b["user_id"], merchant_id)
                delete_merchant(merchant_id)

    def test_unfollow_404_when_not_following(
        self, integration_client, test_user, test_user_b
    ):
        """DELETE follow on a merchant the user never followed → 404."""
        merchant_id = None
        try:
            # test_user creates merchant; test_user_b tries to unfollow without following
            create_resp = integration_client.post(
                "/api/v1/merchants",
                json=make_merchant_payload(),
                headers=test_user["auth_headers"],
            )
            assert create_resp.status_code == 201
            merchant_id = create_resp.json()["id"]

            # Unfollow without having followed
            resp = integration_client.delete(
                f"/api/v1/merchants/{merchant_id}/follow",
                headers=test_user_b["auth_headers"],
            )
            assert resp.status_code == 404
        finally:
            if merchant_id:
                delete_merchant(merchant_id)

    def test_follower_list_returns_empty(
        self, integration_client, test_user
    ):
        """GET /merchants/{id}/followers on merchant with no followers → data=[], count=0."""
        merchant_id = None
        try:
            create_resp = integration_client.post(
                "/api/v1/merchants",
                json=make_merchant_payload(),
                headers=test_user["auth_headers"],
            )
            assert create_resp.status_code == 201
            merchant_id = create_resp.json()["id"]

            # Get followers list (should be empty)
            resp = integration_client.get(
                f"/api/v1/merchants/{merchant_id}/followers",
                headers=test_user["auth_headers"],
            )
            assert resp.status_code == 200
            body = resp.json()
            assert body["data"] == []
            assert body["count"] == 0
        finally:
            if merchant_id:
                delete_merchant(merchant_id)


# ---------------------------------------------------------------------------
# TestGetFollowingIntegration
# ---------------------------------------------------------------------------

class TestGetFollowingIntegration:
    def test_get_following_returns_followed_merchants(
        self, integration_client, test_user, test_user_b
    ):
        """Create merchant, follow it as test_user_b, GET /users/me/following, assert merchant appears."""
        merchant_id = None
        try:
            # test_user creates merchant
            create_resp = integration_client.post(
                "/api/v1/merchants",
                json=make_merchant_payload(),
                headers=test_user["auth_headers"],
            )
            assert create_resp.status_code == 201
            merchant_id = create_resp.json()["id"]

            # test_user_b follows it
            follow_resp = integration_client.post(
                f"/api/v1/merchants/{merchant_id}/follow",
                headers=test_user_b["auth_headers"],
            )
            assert follow_resp.status_code == 201

            # GET /users/me/following as test_user_b
            resp = integration_client.get(
                "/api/v1/users/me/following",
                headers=test_user_b["auth_headers"],
            )
            assert resp.status_code == 200
            body = resp.json()
            assert "data" in body
            assert "count" in body
            assert body["count"] >= 1

            # Verify merchant_id appears in data[]
            merchant_ids = [m["id"] for m in body["data"]]
            assert merchant_id in merchant_ids
        finally:
            if merchant_id:
                _delete_follow(test_user_b["user_id"], merchant_id)
                delete_merchant(merchant_id)


# ---------------------------------------------------------------------------
# TestFollowingFeed
# ---------------------------------------------------------------------------

class TestFollowingFeed:
    def test_following_feed_shows_only_followed_merchants(
        self, integration_client, test_user, test_user_b
    ):
        """Follow merchant A (not B) → GET /feed/following returns only A's posts."""
        merchant_a_id = None
        merchant_b_id = None
        post_a_id = None
        post_b_id = None

        try:
            # Create merchant A (owned by test_user)
            resp_a = integration_client.post(
                "/api/v1/merchants",
                json=make_merchant_payload(name="Merchant A"),
                headers=test_user["auth_headers"],
            )
            assert resp_a.status_code == 201
            merchant_a_id = resp_a.json()["id"]

            # Create merchant B (owned by test_user_b)
            resp_b = integration_client.post(
                "/api/v1/merchants",
                json=make_merchant_payload(name="Merchant B"),
                headers=test_user_b["auth_headers"],
            )
            assert resp_b.status_code == 201
            merchant_b_id = resp_b.json()["id"]

            # Insert a post for each merchant via admin
            post_a_id = _insert_post(merchant_a_id, "Post from Merchant A")
            post_b_id = _insert_post(merchant_b_id, "Post from Merchant B")

            # test_user_b follows merchant A only
            follow_resp = integration_client.post(
                f"/api/v1/merchants/{merchant_a_id}/follow",
                headers=test_user_b["auth_headers"],
            )
            assert follow_resp.status_code == 201

            # GET /feed/following as test_user_b
            feed_resp = integration_client.get(
                "/api/v1/feed/following",
                headers=test_user_b["auth_headers"],
            )
            assert feed_resp.status_code == 200
            feed = feed_resp.json()
            assert "data" in feed

            returned_merchant_ids = {post["merchant"]["id"] for post in feed["data"]}

            # Merchant A's posts must appear
            assert merchant_a_id in returned_merchant_ids, (
                "Expected merchant A's posts in following feed"
            )

            # Merchant B's posts must NOT appear
            assert merchant_b_id not in returned_merchant_ids, (
                "Merchant B not followed — its posts must not appear in following feed"
            )
        finally:
            if merchant_a_id:
                _delete_follow(test_user_b["user_id"], merchant_a_id)
            if post_a_id:
                _delete_post(post_a_id)
            if post_b_id:
                _delete_post(post_b_id)
            if merchant_a_id:
                delete_merchant(merchant_a_id)
            if merchant_b_id:
                delete_merchant(merchant_b_id)

    def test_following_feed_empty_when_not_following(
        self, integration_client, test_user
    ):
        """GET /feed/following with no follows → returns empty data list."""
        # test_user follows nothing — each test session starts fresh; cleanup note:
        # no follow rows exist for test_user in this isolated test session.
        feed_resp = integration_client.get(
            "/api/v1/feed/following",
            headers=test_user["auth_headers"],
        )
        assert feed_resp.status_code == 200
        body = feed_resp.json()
        assert body["has_more"] is False
        assert body["next_cursor"] is None
        assert body["data"] == []

    def test_is_active_false_posts_excluded(
        self, integration_client, test_user, test_user_b
    ):
        """Insert is_active=False post for a followed merchant → does NOT appear in /feed/following."""
        merchant_id = None
        post_active_id = None
        post_inactive_id = None

        try:
            # test_user creates merchant
            create_resp = integration_client.post(
                "/api/v1/merchants",
                json=make_merchant_payload(),
                headers=test_user["auth_headers"],
            )
            assert create_resp.status_code == 201
            merchant_id = create_resp.json()["id"]

            # Insert one active and one inactive post
            post_active_id = _insert_post(merchant_id, "Active post", is_active=True)
            post_inactive_id = _insert_post(merchant_id, "Inactive post", is_active=False)

            # test_user_b follows merchant
            follow_resp = integration_client.post(
                f"/api/v1/merchants/{merchant_id}/follow",
                headers=test_user_b["auth_headers"],
            )
            assert follow_resp.status_code == 201

            # GET /feed/following as test_user_b
            feed_resp = integration_client.get(
                "/api/v1/feed/following",
                headers=test_user_b["auth_headers"],
            )
            assert feed_resp.status_code == 200
            feed = feed_resp.json()

            returned_post_ids = {post["id"] for post in feed["data"]}

            # Active post must appear
            assert str(post_active_id) in returned_post_ids

            # Inactive post must NOT appear
            assert str(post_inactive_id) not in returned_post_ids
        finally:
            if merchant_id:
                _delete_follow(test_user_b["user_id"], merchant_id)
            if post_active_id:
                _delete_post(post_active_id)
            if post_inactive_id:
                _delete_post(post_inactive_id)
            if merchant_id:
                delete_merchant(merchant_id)

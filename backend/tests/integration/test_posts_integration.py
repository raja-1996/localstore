"""
Integration tests for post CRUD, like_count trigger, is_liked_by_me,
comment_count trigger, and non-owner 403 enforcement (S8-T2, S8-T3).

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


# ---------------------------------------------------------------------------
# Service-role helper
# ---------------------------------------------------------------------------

def _get_service_client():
    """Return a service-role Supabase client (bypasses RLS)."""
    from supabase import create_client
    from app.core.config import settings
    return create_client(settings.supabase_url, settings.supabase_secret_default_key)


# ---------------------------------------------------------------------------
# Teardown helpers
# ---------------------------------------------------------------------------

def _delete_post(post_id: str) -> None:
    """Hard-delete a post row via service-role client."""
    try:
        _get_service_client().table("posts").delete().eq("id", post_id).execute()
    except Exception as e:
        print(f"Warning: _delete_post failed for {post_id}: {e}")


def _delete_like(post_id: str, user_id: str) -> None:
    """Hard-delete a like row via service-role client."""
    try:
        (
            _get_service_client()
            .table("likes")
            .delete()
            .eq("post_id", post_id)
            .eq("user_id", user_id)
            .execute()
        )
    except Exception as e:
        print(f"Warning: _delete_like failed for post={post_id} user={user_id}: {e}")


def _delete_comment(comment_id: str) -> None:
    """Hard-delete a comment row via service-role client."""
    try:
        _get_service_client().table("comments").delete().eq("id", comment_id).execute()
    except Exception as e:
        print(f"Warning: _delete_comment failed for {comment_id}: {e}")


# ---------------------------------------------------------------------------
# DB read helpers
# ---------------------------------------------------------------------------

def _get_like_count(post_id: str) -> int:
    """Read like_count for a post via service-role client."""
    result = (
        _get_service_client()
        .table("posts")
        .select("like_count")
        .eq("id", post_id)
        .execute()
    )
    if not result.data:
        return 0
    return int(result.data[0]["like_count"])


def _get_comment_count(post_id: str) -> int:
    """Read comment_count for a post via service-role client."""
    result = (
        _get_service_client()
        .table("posts")
        .select("comment_count")
        .eq("id", post_id)
        .execute()
    )
    if not result.data:
        return 0
    return int(result.data[0]["comment_count"])


def _get_post_is_active(post_id: str) -> bool:
    """Read is_active flag for a post via service-role client."""
    result = (
        _get_service_client()
        .table("posts")
        .select("is_active")
        .eq("id", post_id)
        .execute()
    )
    if not result.data:
        return False
    return bool(result.data[0]["is_active"])


def _make_post_payload(**overrides) -> dict:
    """Return a valid post creation payload."""
    base = {
        "content": "Integration test post content",
        "post_type": "update",
    }
    base.update(overrides)
    return base


# ---------------------------------------------------------------------------
# TestPostCRUD (S8-T2 — create / update / delete)
# ---------------------------------------------------------------------------

class TestPostCRUD:
    def test_create_post_returns_201(
        self, integration_client, test_user
    ):
        """POST /merchants/{id}/posts → 201 with expected fields."""
        merchant_id = None
        post_id = None
        try:
            resp = integration_client.post(
                "/api/v1/merchants",
                json=make_merchant_payload(),
                headers=test_user["auth_headers"],
            )
            assert resp.status_code == 201
            merchant_id = resp.json()["id"]

            post_resp = integration_client.post(
                f"/api/v1/merchants/{merchant_id}/posts",
                json=_make_post_payload(),
                headers=test_user["auth_headers"],
            )
            assert post_resp.status_code == 201, post_resp.text
            body = post_resp.json()
            assert body["content"] == "Integration test post content"
            assert body["post_type"] == "update"
            assert body["like_count"] == 0
            assert body["comment_count"] == 0
            assert "id" in body
            post_id = body["id"]
        finally:
            if post_id:
                _delete_post(post_id)
            if merchant_id:
                delete_merchant(merchant_id)

    def test_patch_post_updates_content(
        self, integration_client, test_user
    ):
        """PATCH /merchants/{id}/posts/{post_id} → 200; content updated in DB."""
        merchant_id = None
        post_id = None
        try:
            resp = integration_client.post(
                "/api/v1/merchants",
                json=make_merchant_payload(),
                headers=test_user["auth_headers"],
            )
            assert resp.status_code == 201
            merchant_id = resp.json()["id"]

            post_resp = integration_client.post(
                f"/api/v1/merchants/{merchant_id}/posts",
                json=_make_post_payload(content="Original content"),
                headers=test_user["auth_headers"],
            )
            assert post_resp.status_code == 201
            post_id = post_resp.json()["id"]

            patch_resp = integration_client.patch(
                f"/api/v1/merchants/{merchant_id}/posts/{post_id}",
                json={"content": "Updated content"},
                headers=test_user["auth_headers"],
            )
            assert patch_resp.status_code == 200, patch_resp.text
            assert patch_resp.json()["content"] == "Updated content"

            # Verify persisted in DB via service-role client
            db_row = (
                _get_service_client()
                .table("posts")
                .select("content")
                .eq("id", post_id)
                .execute()
            )
            assert db_row.data[0]["content"] == "Updated content"
        finally:
            if post_id:
                _delete_post(post_id)
            if merchant_id:
                delete_merchant(merchant_id)

    def test_delete_post_soft_deletes(
        self, integration_client, test_user
    ):
        """DELETE /merchants/{id}/posts/{post_id} → 204; is_active=false in DB."""
        merchant_id = None
        post_id = None
        try:
            resp = integration_client.post(
                "/api/v1/merchants",
                json=make_merchant_payload(),
                headers=test_user["auth_headers"],
            )
            assert resp.status_code == 201
            merchant_id = resp.json()["id"]

            post_resp = integration_client.post(
                f"/api/v1/merchants/{merchant_id}/posts",
                json=_make_post_payload(),
                headers=test_user["auth_headers"],
            )
            assert post_resp.status_code == 201
            post_id = post_resp.json()["id"]

            del_resp = integration_client.delete(
                f"/api/v1/merchants/{merchant_id}/posts/{post_id}",
                headers=test_user["auth_headers"],
            )
            assert del_resp.status_code == 204, del_resp.text

            # Verify soft-delete: is_active must be False in DB
            is_active = _get_post_is_active(post_id)
            assert is_active is False, (
                f"Expected is_active=false after DELETE, got {is_active}"
            )
            post_id = None  # already soft-deleted; hard-delete not needed
        finally:
            if post_id:
                _delete_post(post_id)
            if merchant_id:
                delete_merchant(merchant_id)

    def test_non_owner_cannot_delete_post_403(
        self, integration_client, test_user, test_user_b
    ):
        """Non-owner DELETE /merchants/{id}/posts/{post_id} → 403."""
        merchant_id = None
        post_id = None
        try:
            # test_user creates merchant and post
            resp = integration_client.post(
                "/api/v1/merchants",
                json=make_merchant_payload(),
                headers=test_user["auth_headers"],
            )
            assert resp.status_code == 201
            merchant_id = resp.json()["id"]

            post_resp = integration_client.post(
                f"/api/v1/merchants/{merchant_id}/posts",
                json=_make_post_payload(),
                headers=test_user["auth_headers"],
            )
            assert post_resp.status_code == 201
            post_id = post_resp.json()["id"]

            # test_user_b (non-owner) tries to delete
            del_resp = integration_client.delete(
                f"/api/v1/merchants/{merchant_id}/posts/{post_id}",
                headers=test_user_b["auth_headers"],
            )
            assert del_resp.status_code == 403, (
                f"Expected 403 for non-owner DELETE, got {del_resp.status_code}"
            )
        finally:
            if post_id:
                _delete_post(post_id)
            if merchant_id:
                delete_merchant(merchant_id)


# ---------------------------------------------------------------------------
# TestLikeCountTrigger (S8-T2 — like_count trigger + is_liked_by_me)
# ---------------------------------------------------------------------------

class TestLikeCountTrigger:
    def test_like_increments_like_count(
        self, integration_client, test_user, test_user_b
    ):
        """POST /posts/{id}/like by test_user_b → like_count=1 in DB."""
        merchant_id = None
        post_id = None
        liked = False
        try:
            resp = integration_client.post(
                "/api/v1/merchants",
                json=make_merchant_payload(),
                headers=test_user["auth_headers"],
            )
            assert resp.status_code == 201
            merchant_id = resp.json()["id"]

            post_resp = integration_client.post(
                f"/api/v1/merchants/{merchant_id}/posts",
                json=_make_post_payload(),
                headers=test_user["auth_headers"],
            )
            assert post_resp.status_code == 201
            post_id = post_resp.json()["id"]

            like_resp = integration_client.post(
                f"/api/v1/posts/{post_id}/like",
                headers=test_user_b["auth_headers"],
            )
            assert like_resp.status_code == 201, like_resp.text
            liked = True

            count = _get_like_count(post_id)
            assert count == 1, f"Expected like_count=1, got {count}"
        finally:
            if liked and post_id:
                _delete_like(post_id, test_user_b["user_id"])
            if post_id:
                _delete_post(post_id)
            if merchant_id:
                delete_merchant(merchant_id)

    def test_unlike_decrements_like_count(
        self, integration_client, test_user, test_user_b
    ):
        """DELETE /posts/{id}/like after liking → like_count=0 in DB."""
        merchant_id = None
        post_id = None
        try:
            resp = integration_client.post(
                "/api/v1/merchants",
                json=make_merchant_payload(),
                headers=test_user["auth_headers"],
            )
            assert resp.status_code == 201
            merchant_id = resp.json()["id"]

            post_resp = integration_client.post(
                f"/api/v1/merchants/{merchant_id}/posts",
                json=_make_post_payload(),
                headers=test_user["auth_headers"],
            )
            assert post_resp.status_code == 201
            post_id = post_resp.json()["id"]

            # Like
            like_resp = integration_client.post(
                f"/api/v1/posts/{post_id}/like",
                headers=test_user_b["auth_headers"],
            )
            assert like_resp.status_code == 201

            # Confirm like_count=1 before unlike
            assert _get_like_count(post_id) == 1

            # Unlike
            unlike_resp = integration_client.delete(
                f"/api/v1/posts/{post_id}/like",
                headers=test_user_b["auth_headers"],
            )
            assert unlike_resp.status_code == 204, unlike_resp.text

            count = _get_like_count(post_id)
            assert count == 0, f"Expected like_count=0 after unlike, got {count}"
        finally:
            if post_id:
                _delete_post(post_id)
            if merchant_id:
                delete_merchant(merchant_id)

    def test_is_liked_by_me_true_for_liker(
        self, integration_client, test_user, test_user_b
    ):
        """GET /merchants/{id}/posts → is_liked_by_me=true for the user who liked."""
        merchant_id = None
        post_id = None
        liked = False
        try:
            resp = integration_client.post(
                "/api/v1/merchants",
                json=make_merchant_payload(),
                headers=test_user["auth_headers"],
            )
            assert resp.status_code == 201
            merchant_id = resp.json()["id"]

            post_resp = integration_client.post(
                f"/api/v1/merchants/{merchant_id}/posts",
                json=_make_post_payload(),
                headers=test_user["auth_headers"],
            )
            assert post_resp.status_code == 201
            post_id = post_resp.json()["id"]

            # test_user_b likes the post
            like_resp = integration_client.post(
                f"/api/v1/posts/{post_id}/like",
                headers=test_user_b["auth_headers"],
            )
            assert like_resp.status_code == 201
            liked = True

            # Fetch posts as test_user_b (the liker)
            list_resp = integration_client.get(
                f"/api/v1/merchants/{merchant_id}/posts",
                headers=test_user_b["auth_headers"],
            )
            assert list_resp.status_code == 200
            posts = list_resp.json()["data"]
            target = next((p for p in posts if p["id"] == post_id), None)
            assert target is not None, "Post not found in list response"
            assert target["is_liked_by_me"] is True, (
                f"Expected is_liked_by_me=true for liker, got {target['is_liked_by_me']}"
            )
        finally:
            if liked and post_id:
                _delete_like(post_id, test_user_b["user_id"])
            if post_id:
                _delete_post(post_id)
            if merchant_id:
                delete_merchant(merchant_id)

    def test_is_liked_by_me_false_for_non_liker(
        self, integration_client, test_user, test_user_b
    ):
        """GET /merchants/{id}/posts → is_liked_by_me=false for a user who has not liked."""
        merchant_id = None
        post_id = None
        liked = False
        try:
            resp = integration_client.post(
                "/api/v1/merchants",
                json=make_merchant_payload(),
                headers=test_user["auth_headers"],
            )
            assert resp.status_code == 201
            merchant_id = resp.json()["id"]

            post_resp = integration_client.post(
                f"/api/v1/merchants/{merchant_id}/posts",
                json=_make_post_payload(),
                headers=test_user["auth_headers"],
            )
            assert post_resp.status_code == 201
            post_id = post_resp.json()["id"]

            # test_user_b likes the post
            like_resp = integration_client.post(
                f"/api/v1/posts/{post_id}/like",
                headers=test_user_b["auth_headers"],
            )
            assert like_resp.status_code == 201
            liked = True

            # Fetch posts as test_user (the NON-liker / merchant owner)
            list_resp = integration_client.get(
                f"/api/v1/merchants/{merchant_id}/posts",
                headers=test_user["auth_headers"],
            )
            assert list_resp.status_code == 200
            posts = list_resp.json()["data"]
            target = next((p for p in posts if p["id"] == post_id), None)
            assert target is not None, "Post not found in list response"
            assert target["is_liked_by_me"] is False, (
                f"Expected is_liked_by_me=false for non-liker, got {target['is_liked_by_me']}"
            )
        finally:
            if liked and post_id:
                _delete_like(post_id, test_user_b["user_id"])
            if post_id:
                _delete_post(post_id)
            if merchant_id:
                delete_merchant(merchant_id)


# ---------------------------------------------------------------------------
# TestCommentCountTrigger (S8-T3 — comment_count trigger + non-owner 403)
# ---------------------------------------------------------------------------

class TestCommentCountTrigger:
    def test_post_comment_increments_comment_count(
        self, integration_client, test_user, test_user_b
    ):
        """POST /posts/{id}/comments → comment_count increments to 1."""
        merchant_id = None
        post_id = None
        comment_id = None
        try:
            resp = integration_client.post(
                "/api/v1/merchants",
                json=make_merchant_payload(),
                headers=test_user["auth_headers"],
            )
            assert resp.status_code == 201
            merchant_id = resp.json()["id"]

            post_resp = integration_client.post(
                f"/api/v1/merchants/{merchant_id}/posts",
                json=_make_post_payload(),
                headers=test_user["auth_headers"],
            )
            assert post_resp.status_code == 201
            post_id = post_resp.json()["id"]

            comment_resp = integration_client.post(
                f"/api/v1/posts/{post_id}/comments",
                json={"content": "Great post!"},
                headers=test_user_b["auth_headers"],
            )
            assert comment_resp.status_code == 201, comment_resp.text
            comment_id = comment_resp.json()["id"]

            count = _get_comment_count(post_id)
            assert count == 1, f"Expected comment_count=1, got {count}"
        finally:
            if comment_id:
                _delete_comment(comment_id)
            if post_id:
                _delete_post(post_id)
            if merchant_id:
                delete_merchant(merchant_id)

    def test_delete_comment_decrements_comment_count(
        self, integration_client, test_user, test_user_b
    ):
        """DELETE /posts/{id}/comments/{comment_id} → comment_count decrements to 0."""
        merchant_id = None
        post_id = None
        comment_id = None
        try:
            resp = integration_client.post(
                "/api/v1/merchants",
                json=make_merchant_payload(),
                headers=test_user["auth_headers"],
            )
            assert resp.status_code == 201
            merchant_id = resp.json()["id"]

            post_resp = integration_client.post(
                f"/api/v1/merchants/{merchant_id}/posts",
                json=_make_post_payload(),
                headers=test_user["auth_headers"],
            )
            assert post_resp.status_code == 201
            post_id = post_resp.json()["id"]

            comment_resp = integration_client.post(
                f"/api/v1/posts/{post_id}/comments",
                json={"content": "Nice!"},
                headers=test_user_b["auth_headers"],
            )
            assert comment_resp.status_code == 201
            comment_id = comment_resp.json()["id"]

            # Confirm count=1 before delete
            assert _get_comment_count(post_id) == 1

            del_resp = integration_client.delete(
                f"/api/v1/posts/{post_id}/comments/{comment_id}",
                headers=test_user_b["auth_headers"],
            )
            assert del_resp.status_code == 204, del_resp.text
            comment_id = None  # already deleted; skip cleanup

            count = _get_comment_count(post_id)
            assert count == 0, f"Expected comment_count=0 after delete, got {count}"
        finally:
            if comment_id:
                _delete_comment(comment_id)
            if post_id:
                _delete_post(post_id)
            if merchant_id:
                delete_merchant(merchant_id)

    def test_non_owner_patch_comment_403(
        self, integration_client, test_user, test_user_b
    ):
        """PATCH comment by a user who did not write it → 403."""
        merchant_id = None
        post_id = None
        comment_id = None
        try:
            # test_user creates merchant + post
            resp = integration_client.post(
                "/api/v1/merchants",
                json=make_merchant_payload(),
                headers=test_user["auth_headers"],
            )
            assert resp.status_code == 201
            merchant_id = resp.json()["id"]

            post_resp = integration_client.post(
                f"/api/v1/merchants/{merchant_id}/posts",
                json=_make_post_payload(),
                headers=test_user["auth_headers"],
            )
            assert post_resp.status_code == 201
            post_id = post_resp.json()["id"]

            # test_user_b writes the comment
            comment_resp = integration_client.post(
                f"/api/v1/posts/{post_id}/comments",
                json={"content": "Original comment"},
                headers=test_user_b["auth_headers"],
            )
            assert comment_resp.status_code == 201
            comment_id = comment_resp.json()["id"]

            # test_user (NOT the comment author) tries to PATCH
            patch_resp = integration_client.patch(
                f"/api/v1/posts/{post_id}/comments/{comment_id}",
                json={"content": "Tampered content"},
                headers=test_user["auth_headers"],
            )
            assert patch_resp.status_code == 403, (
                f"Expected 403 for non-owner PATCH comment, got {patch_resp.status_code}"
            )
        finally:
            if comment_id:
                _delete_comment(comment_id)
            if post_id:
                _delete_post(post_id)
            if merchant_id:
                delete_merchant(merchant_id)

    def test_non_owner_delete_comment_403(
        self, integration_client, test_user, test_user_b
    ):
        """DELETE comment by a user who did not write it → 403."""
        merchant_id = None
        post_id = None
        comment_id = None
        try:
            # test_user creates merchant + post
            resp = integration_client.post(
                "/api/v1/merchants",
                json=make_merchant_payload(),
                headers=test_user["auth_headers"],
            )
            assert resp.status_code == 201
            merchant_id = resp.json()["id"]

            post_resp = integration_client.post(
                f"/api/v1/merchants/{merchant_id}/posts",
                json=_make_post_payload(),
                headers=test_user["auth_headers"],
            )
            assert post_resp.status_code == 201
            post_id = post_resp.json()["id"]

            # test_user_b writes the comment
            comment_resp = integration_client.post(
                f"/api/v1/posts/{post_id}/comments",
                json={"content": "A comment"},
                headers=test_user_b["auth_headers"],
            )
            assert comment_resp.status_code == 201
            comment_id = comment_resp.json()["id"]

            # test_user (NOT the comment author) tries to DELETE
            del_resp = integration_client.delete(
                f"/api/v1/posts/{post_id}/comments/{comment_id}",
                headers=test_user["auth_headers"],
            )
            assert del_resp.status_code == 403, (
                f"Expected 403 for non-owner DELETE comment, got {del_resp.status_code}"
            )
        finally:
            if comment_id:
                _delete_comment(comment_id)
            if post_id:
                _delete_post(post_id)
            if merchant_id:
                delete_merchant(merchant_id)

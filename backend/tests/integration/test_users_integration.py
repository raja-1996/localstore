"""
Integration tests for /api/v1/users/me endpoints.

Requires a running Supabase instance with the `profiles` table auto-populated
by the on-signup trigger. Automatically skipped if the instance is unreachable.

All tests share the session-scoped `test_user` fixture. The profile row for that
user is created automatically by Supabase when the user signs up.
"""
import uuid

import pytest

from tests.integration.conftest import (
    TEST_PASSWORD,
    _create_test_user,
    skip_if_no_supabase,
)

pytestmark = skip_if_no_supabase


class TestGetUserProfileIntegration:
    def test_get_own_profile(self, integration_client, test_user):
        """Profile row must exist after signup trigger runs."""
        resp = integration_client.get(
            "/api/v1/users/me",
            headers=test_user["auth_headers"],
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["id"] == test_user["user_id"]
        assert "email" in data
        assert "created_at" in data

    def test_get_profile_no_auth(self, integration_client):
        """Missing Authorization header → FastAPI validation returns 422."""
        resp = integration_client.get("/api/v1/users/me")
        assert resp.status_code == 422


class TestUpdateUserProfileIntegration:
    def test_update_full_name(self, integration_client, test_user):
        new_name = f"Integration User {uuid.uuid4().hex[:6]}"
        resp = integration_client.patch(
            "/api/v1/users/me",
            json={"full_name": new_name},
            headers=test_user["auth_headers"],
        )
        assert resp.status_code == 200
        assert resp.json()["full_name"] == new_name

    def test_update_avatar_url(self, integration_client, test_user):
        avatar = "https://example.com/avatar-integration.png"
        resp = integration_client.patch(
            "/api/v1/users/me",
            json={"avatar_url": avatar},
            headers=test_user["auth_headers"],
        )
        assert resp.status_code == 200
        assert resp.json()["avatar_url"] == avatar

    def test_update_partial_fields(self, integration_client, test_user):
        """Update only full_name; avatar_url must remain unchanged."""
        # First set a known avatar_url so we have a stable baseline
        setup_avatar = "https://example.com/stable-avatar.png"
        integration_client.patch(
            "/api/v1/users/me",
            json={"avatar_url": setup_avatar},
            headers=test_user["auth_headers"],
        )

        # Now patch only full_name
        new_name = f"Partial Update {uuid.uuid4().hex[:6]}"
        resp = integration_client.patch(
            "/api/v1/users/me",
            json={"full_name": new_name},
            headers=test_user["auth_headers"],
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["full_name"] == new_name
        # avatar_url must not have been cleared
        assert data["avatar_url"] == setup_avatar

    def test_update_empty_body(self, integration_client, test_user):
        """PATCH with empty body → 400 with 'No fields to update'."""
        resp = integration_client.patch(
            "/api/v1/users/me",
            json={},
            headers=test_user["auth_headers"],
        )
        assert resp.status_code == 400
        assert resp.json()["detail"] == "No fields to update"

    def test_update_no_auth(self, integration_client):
        """Missing Authorization header → FastAPI validation returns 422."""
        resp = integration_client.patch(
            "/api/v1/users/me",
            json={"full_name": "Ghost"},
        )
        assert resp.status_code == 422


class TestUserProfileAutoCreatedOnSignup:
    def test_profile_auto_created_on_signup(self, integration_client):
        """
        Sign up a brand-new user, immediately GET /api/v1/users/me, and verify
        the profile row was created by the Supabase on-signup trigger.
        Deletes the test user after the assertion.
        """
        new_user = _create_test_user(integration_client, "users-signup-test")

        try:
            resp = integration_client.get(
                "/api/v1/users/me",
                headers=new_user["auth_headers"],
            )
            assert resp.status_code == 200
            data = resp.json()
            assert data["id"] == new_user["user_id"]
        finally:
            # Cleanup: delete the newly created user via admin API
            from app.core.supabase import get_supabase

            try:
                get_supabase().auth.admin.delete_user(new_user["user_id"])
            except Exception as e:
                print(f"[integration] Warning: could not delete signup test user: {e}")



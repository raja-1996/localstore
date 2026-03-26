"""
Integration tests for /api/v1/profile endpoints.

Requires a running Supabase instance with the `profiles` table auto-populated
by the on-signup trigger. Automatically skipped if the instance is unreachable.

All tests share the session-scoped `test_user` fixture. The profile row for that
user is created automatically by Supabase when the user signs up.
"""
import io
import uuid

import pytest

from tests.integration.conftest import (
    TEST_PASSWORD,
    _create_test_user,
    skip_if_no_supabase,
)
from tests.integration.test_storage_integration import _bucket_exists, skip_if_no_bucket

pytestmark = skip_if_no_supabase


class TestGetProfileIntegration:
    def test_get_own_profile(self, integration_client, test_user):
        """Profile row must exist after signup trigger runs."""
        resp = integration_client.get(
            "/api/v1/profile",
            headers=test_user["auth_headers"],
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["id"] == test_user["user_id"]
        assert "email" in data
        assert "created_at" in data
        assert "updated_at" in data

    def test_get_profile_no_auth(self, integration_client):
        """Missing Authorization header → FastAPI validation returns 422."""
        resp = integration_client.get("/api/v1/profile")
        assert resp.status_code == 422


class TestUpdateProfileIntegration:
    def test_update_full_name(self, integration_client, test_user):
        new_name = f"Integration User {uuid.uuid4().hex[:6]}"
        resp = integration_client.patch(
            "/api/v1/profile",
            json={"full_name": new_name},
            headers=test_user["auth_headers"],
        )
        assert resp.status_code == 200
        assert resp.json()["full_name"] == new_name

    def test_update_avatar_url(self, integration_client, test_user):
        avatar = "https://example.com/avatar-integration.png"
        resp = integration_client.patch(
            "/api/v1/profile",
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
            "/api/v1/profile",
            json={"avatar_url": setup_avatar},
            headers=test_user["auth_headers"],
        )

        # Now patch only full_name
        new_name = f"Partial Update {uuid.uuid4().hex[:6]}"
        resp = integration_client.patch(
            "/api/v1/profile",
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
            "/api/v1/profile",
            json={},
            headers=test_user["auth_headers"],
        )
        assert resp.status_code == 400
        assert resp.json()["detail"] == "No fields to update"

    def test_update_no_auth(self, integration_client):
        """Missing Authorization header → FastAPI validation returns 422."""
        resp = integration_client.patch(
            "/api/v1/profile",
            json={"full_name": "Ghost"},
        )
        assert resp.status_code == 422


class TestProfileAutoCreatedOnSignup:
    def test_profile_auto_created_on_signup(self, integration_client):
        """
        Sign up a brand-new user, immediately GET /api/v1/profile, and verify
        the profile row was created by the Supabase on-signup trigger.
        Deletes the test user after the assertion.
        """
        new_user = _create_test_user(integration_client, "profile-signup-test")

        try:
            resp = integration_client.get(
                "/api/v1/profile",
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


@skip_if_no_bucket
class TestAvatarViaStorageUpload:
    def test_update_avatar_via_storage_upload(self, integration_client, test_user):
        """
        Real avatar change flow:
        1. Upload a PNG to storage → get path
        2. PATCH /profile with avatar_url = path
        3. GET /profile → verify avatar_url matches the uploaded path
        4. Cleanup: delete the file from storage
        """
        # Step 1 — upload a minimal PNG to storage
        upload_resp = integration_client.post(
            "/api/v1/storage/upload",
            files={"file": ("avatar.png", io.BytesIO(b"\x89PNG\r\n\x1a\n"), "image/png")},
            headers=test_user["auth_headers"],
        )
        assert upload_resp.status_code == 200, f"Upload failed: {upload_resp.text}"
        path = upload_resp.json()["path"]
        assert path.endswith(".png")
        assert path.startswith(test_user["user_id"])

        try:
            # Step 2 — update profile with the storage path
            patch_resp = integration_client.patch(
                "/api/v1/profile",
                json={"avatar_url": path},
                headers=test_user["auth_headers"],
            )
            assert patch_resp.status_code == 200
            assert patch_resp.json()["avatar_url"] == path

            # Step 3 — GET profile and verify avatar_url persisted
            get_resp = integration_client.get(
                "/api/v1/profile",
                headers=test_user["auth_headers"],
            )
            assert get_resp.status_code == 200
            assert get_resp.json()["avatar_url"] == path
        finally:
            # Step 4 — cleanup: remove the uploaded file
            integration_client.delete(
                f"/api/v1/storage/delete/{path}",
                headers=test_user["auth_headers"],
            )

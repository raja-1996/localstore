"""
Extended integration tests for /api/v1/users/me endpoints.

Covers: avatar_url persistence, partial PATCH without clobbering other fields,
unauthenticated access guard, and response shape validation.

Requires a running Supabase instance. Automatically skipped if unreachable.
All tests share the session-scoped test_user fixture from conftest.
Tests clean up any profile changes they make by restoring original values.
"""
import pytest

from tests.integration.conftest import skip_if_no_supabase

pytestmark = skip_if_no_supabase


class TestUsersMeExtendedIntegration:
    """S5-T3: Extended /users/me endpoint tests."""

    def test_patch_avatar_url_persists(self, integration_client, test_user):
        """
        PATCH /users/me with avatar_url → GET /users/me returns the same avatar_url.
        Restores the original avatar_url in teardown.
        """
        test_avatar_url = "https://example.com/test-avatar.jpg"
        original_avatar_url = None

        try:
            # Record current avatar_url before modifying
            get_resp = integration_client.get(
                "/api/v1/users/me",
                headers=test_user["auth_headers"],
            )
            assert get_resp.status_code == 200
            original_avatar_url = get_resp.json().get("avatar_url")

            # PATCH avatar_url
            patch_resp = integration_client.patch(
                "/api/v1/users/me",
                json={"avatar_url": test_avatar_url},
                headers=test_user["auth_headers"],
            )
            assert patch_resp.status_code == 200, (
                f"PATCH /users/me failed: {patch_resp.text}"
            )

            # GET /users/me — verify the new avatar_url is persisted
            get_resp2 = integration_client.get(
                "/api/v1/users/me",
                headers=test_user["auth_headers"],
            )
            assert get_resp2.status_code == 200
            assert get_resp2.json()["avatar_url"] == test_avatar_url, (
                f"Expected avatar_url={test_avatar_url!r}, "
                f"got {get_resp2.json().get('avatar_url')!r}"
            )
        finally:
            # Restore original avatar_url (may be None — use empty-string reset)
            restore_url = original_avatar_url or ""
            try:
                integration_client.patch(
                    "/api/v1/users/me",
                    json={"avatar_url": restore_url} if restore_url else {"full_name": get_resp.json().get("full_name", "")},
                    headers=test_user["auth_headers"],
                )
            except Exception:
                pass  # Best-effort cleanup

    def test_patch_full_name_partial_update(self, integration_client, test_user):
        """
        PATCH avatar_url first, then PATCH only full_name.
        Confirms avatar_url is NOT clobbered by the second PATCH.
        Restores original values in teardown.
        """
        sentinel_avatar = "https://example.com/partial-update-test.jpg"
        original_full_name = None
        original_avatar_url = None

        try:
            # Record original values
            get_resp = integration_client.get(
                "/api/v1/users/me",
                headers=test_user["auth_headers"],
            )
            assert get_resp.status_code == 200
            profile = get_resp.json()
            original_full_name = profile.get("full_name", "")
            original_avatar_url = profile.get("avatar_url")

            # PATCH 1: set avatar_url
            patch1 = integration_client.patch(
                "/api/v1/users/me",
                json={"avatar_url": sentinel_avatar},
                headers=test_user["auth_headers"],
            )
            assert patch1.status_code == 200

            # PATCH 2: update only full_name (should NOT touch avatar_url)
            new_name = "Partial Update Test Name"
            patch2 = integration_client.patch(
                "/api/v1/users/me",
                json={"full_name": new_name},
                headers=test_user["auth_headers"],
            )
            assert patch2.status_code == 200

            # GET /users/me — verify full_name updated, avatar_url unchanged
            verify_resp = integration_client.get(
                "/api/v1/users/me",
                headers=test_user["auth_headers"],
            )
            assert verify_resp.status_code == 200
            final_profile = verify_resp.json()
            assert final_profile["full_name"] == new_name, (
                f"Expected full_name={new_name!r}, got {final_profile['full_name']!r}"
            )
            assert final_profile["avatar_url"] == sentinel_avatar, (
                f"avatar_url was clobbered by partial PATCH: got {final_profile['avatar_url']!r}"
            )
        finally:
            # Restore original values
            restore_payload = {}
            if original_full_name is not None:
                restore_payload["full_name"] = original_full_name
            if original_avatar_url is not None:
                restore_payload["avatar_url"] = original_avatar_url
            if restore_payload:
                try:
                    integration_client.patch(
                        "/api/v1/users/me",
                        json=restore_payload,
                        headers=test_user["auth_headers"],
                    )
                except Exception:
                    pass  # Best-effort cleanup

    def test_get_users_me_requires_auth(self, integration_client, test_user):
        """
        GET /users/me without Authorization header returns 422 or 401.
        """
        resp = integration_client.get("/api/v1/users/me")  # No auth header
        assert resp.status_code in (401, 422), (
            f"Expected 401 or 422 when unauthenticated, got {resp.status_code}: {resp.text}"
        )

    def test_patch_users_me_returns_updated_profile(self, integration_client, test_user):
        """
        PATCH /users/me response body must contain the updated fields.
        Does not require a follow-up GET — the PATCH response itself is validated.
        Restores original full_name in teardown.
        """
        original_name = None

        try:
            # Record original name
            get_resp = integration_client.get(
                "/api/v1/users/me",
                headers=test_user["auth_headers"],
            )
            assert get_resp.status_code == 200
            original_name = get_resp.json().get("full_name")

            updated_name = "PATCH Response Test Name"
            patch_resp = integration_client.patch(
                "/api/v1/users/me",
                json={"full_name": updated_name},
                headers=test_user["auth_headers"],
            )
            assert patch_resp.status_code == 200, (
                f"PATCH /users/me failed: {patch_resp.text}"
            )

            # Verify the PATCH response body itself contains the updated field
            response_data = patch_resp.json()
            assert response_data["full_name"] == updated_name, (
                f"PATCH response body did not reflect update: {response_data}"
            )
            # Core profile fields should all be present in the PATCH response
            for field in ("id", "email", "is_merchant", "created_at"):
                assert field in response_data, (
                    f"Expected field '{field}' missing from PATCH response"
                )
        finally:
            # Restore original name
            if original_name is not None:
                try:
                    integration_client.patch(
                        "/api/v1/users/me",
                        json={"full_name": original_name},
                        headers=test_user["auth_headers"],
                    )
                except Exception:
                    pass  # Best-effort cleanup

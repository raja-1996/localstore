"""
Integration tests for /api/v1/storage endpoints.

Requires a running Supabase instance with an `uploads` storage bucket.

Create the bucket before running:
    - Via Supabase Studio (http://localhost:54323) → Storage → New bucket "uploads"
    - Or via SQL: insert into storage.buckets (id, name) values ('uploads', 'uploads');

Tests are skipped if Supabase is not reachable OR if the bucket is not present.
"""
import io
import uuid
import pytest

from tests.integration.conftest import skip_if_no_supabase, _SUPABASE_AVAILABLE

pytestmark = skip_if_no_supabase


def _bucket_exists() -> bool:
    """
    Return True if the 'uploads' bucket is accessible.

    NOTE: Called at collection time. The unit-test conftest may have initialized
    get_supabase() with fake credentials (via lru_cache) before the integration
    conftest loads .env.test. We clear the cache here so the real remote credentials
    are used when checking for the bucket.
    """
    if not _SUPABASE_AVAILABLE:
        return False
    try:
        import importlib
        import app.core.config as config_module
        import app.core.supabase as supabase_module
        importlib.reload(config_module)
        supabase_module.settings = config_module.settings
        supabase_module.get_supabase.cache_clear()
        from app.core.supabase import get_supabase
        buckets = get_supabase().storage.list_buckets()
        return any(
            getattr(b, "id", None) == "uploads"
            or (isinstance(b, dict) and b.get("id") == "uploads")
            for b in buckets
        )
    except Exception:
        return False


skip_if_no_bucket = pytest.mark.skipif(
    not _bucket_exists(),
    reason="Supabase 'uploads' bucket not found. Create it before running storage tests.",
)


@pytest.fixture
def uploaded_file(integration_client, test_user):
    """
    Upload a small text file and yield its path. Deleted after the test.
    scope: function — one file per test
    """
    resp = integration_client.post(
        "/api/v1/storage/upload",
        files={"file": ("hello.txt", io.BytesIO(b"hello integration"), "text/plain")},
        headers=test_user["auth_headers"],
    )
    assert resp.status_code == 200, f"Upload failed: {resp.text}"
    path = resp.json()["path"]
    yield path
    integration_client.delete(
        f"/api/v1/storage/delete/{path}",
        headers=test_user["auth_headers"],
    )


@skip_if_no_bucket
class TestUploadIntegration:
    def test_upload_returns_path_and_url(self, integration_client, test_user):
        resp = integration_client.post(
            "/api/v1/storage/upload",
            files={"file": ("test.txt", io.BytesIO(b"test content"), "text/plain")},
            headers=test_user["auth_headers"],
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "path" in data
        assert data["path"]
        assert data["url"].startswith("http")
        try:
            pass  # assertions above; cleanup below
        finally:
            integration_client.delete(
                f"/api/v1/storage/delete/{data['path']}",
                headers=test_user["auth_headers"],
            )

    def test_upload_custom_path(self, integration_client, test_user):
        custom_path = f"{test_user['user_id']}/custom/{uuid.uuid4().hex}.txt"
        resp = integration_client.post(
            "/api/v1/storage/upload",
            files={"file": ("custom.txt", io.BytesIO(b"custom"), "text/plain")},
            data={"path": custom_path},
            headers=test_user["auth_headers"],
        )
        assert resp.status_code == 200
        assert resp.json()["path"] == custom_path
        try:
            pass
        finally:
            integration_client.delete(
                f"/api/v1/storage/delete/{custom_path}",
                headers=test_user["auth_headers"],
            )

    def test_upload_auto_generates_path_with_user_prefix(self, integration_client, test_user):
        resp = integration_client.post(
            "/api/v1/storage/upload",
            files={"file": ("auto.png", io.BytesIO(b"\x89PNG"), "image/png")},
            headers=test_user["auth_headers"],
        )
        assert resp.status_code == 200
        path = resp.json()["path"]
        assert path.startswith(test_user["user_id"])
        assert path.endswith(".png")
        try:
            pass
        finally:
            integration_client.delete(
                f"/api/v1/storage/delete/{path}",
                headers=test_user["auth_headers"],
            )

    def test_upload_no_extension_uses_bin(self, integration_client, test_user):
        resp = integration_client.post(
            "/api/v1/storage/upload",
            files={"file": ("noext", io.BytesIO(b"data"), "application/octet-stream")},
            headers=test_user["auth_headers"],
        )
        assert resp.status_code == 200
        path = resp.json()["path"]
        assert path.endswith(".bin")
        try:
            pass
        finally:
            integration_client.delete(
                f"/api/v1/storage/delete/{path}",
                headers=test_user["auth_headers"],
            )

    def test_upload_requires_auth(self, integration_client):
        resp = integration_client.post(
            "/api/v1/storage/upload",
            files={"file": ("test.txt", io.BytesIO(b"data"), "text/plain")},
        )
        assert resp.status_code == 422

    # Merged from TestUploadIntegrationExtra

    def test_upload_special_characters_in_filename(self, integration_client, test_user):
        resp = integration_client.post(
            "/api/v1/storage/upload",
            files={"file": ("my file (1).txt", io.BytesIO(b"spaces"), "text/plain")},
            headers=test_user["auth_headers"],
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["path"]
        try:
            pass
        finally:
            integration_client.delete(
                f"/api/v1/storage/delete/{data['path']}",
                headers=test_user["auth_headers"],
            )

    def test_upload_signed_url_format(self, integration_client, test_user):
        resp = integration_client.post(
            "/api/v1/storage/upload",
            files={"file": ("url_check.txt", io.BytesIO(b"url"), "text/plain")},
            headers=test_user["auth_headers"],
        )
        assert resp.status_code == 200
        url = resp.json()["url"]
        assert url.startswith("http")
        # Signed URLs from Supabase Storage contain query parameters for the token/expiry
        assert "?" in url
        try:
            pass
        finally:
            integration_client.delete(
                f"/api/v1/storage/delete/{resp.json()['path']}",
                headers=test_user["auth_headers"],
            )


@skip_if_no_bucket
class TestDownloadIntegration:
    def test_download_returns_signed_url(self, integration_client, test_user, uploaded_file):
        resp = integration_client.get(
            f"/api/v1/storage/download/{uploaded_file}",
            headers=test_user["auth_headers"],
        )
        assert resp.status_code == 200
        assert resp.json()["url"].startswith("http")

    def test_download_nonexistent_file(self, integration_client, test_user):
        resp = integration_client.get(
            "/api/v1/storage/download/nonexistent/path/file.txt",
            headers=test_user["auth_headers"],
        )
        assert resp.status_code == 404

    def test_download_requires_auth(self, integration_client, uploaded_file):
        resp = integration_client.get(f"/api/v1/storage/download/{uploaded_file}")
        assert resp.status_code == 422

    # Merged from TestDownloadIntegrationExtra

    def test_download_signed_url_format(self, integration_client, test_user, uploaded_file):
        resp = integration_client.get(
            f"/api/v1/storage/download/{uploaded_file}",
            headers=test_user["auth_headers"],
        )
        assert resp.status_code == 200
        url = resp.json()["url"]
        assert url.startswith("http")


@skip_if_no_bucket
class TestDeleteFileIntegration:
    def test_delete_file(self, integration_client, test_user):
        # Upload first
        up_resp = integration_client.post(
            "/api/v1/storage/upload",
            files={"file": ("todelete.txt", io.BytesIO(b"bye"), "text/plain")},
            headers=test_user["auth_headers"],
        )
        assert up_resp.status_code == 200
        path = up_resp.json()["path"]

        # Delete
        del_resp = integration_client.delete(
            f"/api/v1/storage/delete/{path}",
            headers=test_user["auth_headers"],
        )
        assert del_resp.status_code == 204

    def test_delete_requires_auth(self, integration_client, test_user):
        # Upload a dedicated file for this test so teardown is independent of
        # any shared fixture; the file is never meant to be deleted by this test.
        up_resp = integration_client.post(
            "/api/v1/storage/upload",
            files={"file": ("auth_check.txt", io.BytesIO(b"auth check"), "text/plain")},
            headers=test_user["auth_headers"],
        )
        assert up_resp.status_code == 200, f"Upload failed: {up_resp.text}"
        path = up_resp.json()["path"]

        try:
            resp = integration_client.delete(f"/api/v1/storage/delete/{path}")
            assert resp.status_code == 422
        finally:
            # Always clean up the uploaded file regardless of assertion outcome
            integration_client.delete(
                f"/api/v1/storage/delete/{path}",
                headers=test_user["auth_headers"],
            )

    def test_delete_then_download_returns_404(self, integration_client, test_user):
        # Upload a file
        up_resp = integration_client.post(
            "/api/v1/storage/upload",
            files={"file": ("gone.txt", io.BytesIO(b"temporary"), "text/plain")},
            headers=test_user["auth_headers"],
        )
        assert up_resp.status_code == 200
        path = up_resp.json()["path"]

        # Delete it
        del_resp = integration_client.delete(
            f"/api/v1/storage/delete/{path}",
            headers=test_user["auth_headers"],
        )
        assert del_resp.status_code == 204

        # Attempt to download — must return 404
        dl_resp = integration_client.get(
            f"/api/v1/storage/download/{path}",
            headers=test_user["auth_headers"],
        )
        assert dl_resp.status_code == 404


@skip_if_no_bucket
class TestCrossUserRLS:
    def test_user_cannot_download_other_users_file(
        self, integration_client, test_user, test_user_b
    ):
        # User A uploads a file
        up_resp = integration_client.post(
            "/api/v1/storage/upload",
            files={"file": ("private.txt", io.BytesIO(b"secret"), "text/plain")},
            headers=test_user["auth_headers"],
        )
        assert up_resp.status_code == 200
        path = up_resp.json()["path"]

        try:
            # User B tries to download User A's file
            # Supabase RLS may return 403 (forbidden) or 404 (not found) depending on policy config
            dl_resp = integration_client.get(
                f"/api/v1/storage/download/{path}",
                headers=test_user_b["auth_headers"],
            )
            assert dl_resp.status_code in (403, 404)
        finally:
            # Cleanup: User A deletes the file
            integration_client.delete(
                f"/api/v1/storage/delete/{path}",
                headers=test_user["auth_headers"],
            )

    def test_user_cannot_delete_other_users_file(
        self, integration_client, test_user, test_user_b
    ):
        # User A uploads a file
        up_resp = integration_client.post(
            "/api/v1/storage/upload",
            files={"file": ("mine.txt", io.BytesIO(b"mine"), "text/plain")},
            headers=test_user["auth_headers"],
        )
        assert up_resp.status_code == 200
        path = up_resp.json()["path"]

        try:
            # User B attempts to delete User A's file.
            # Supabase Storage silently returns 204 even when RLS blocks the delete
            # (a SQL DELETE that matches 0 rows due to RLS is not an error).
            # We verify the *effect*: the file must still be downloadable by User A.
            integration_client.delete(
                f"/api/v1/storage/delete/{path}",
                headers=test_user_b["auth_headers"],
            )

            # File must still exist — RLS prevented the actual deletion
            dl_resp = integration_client.get(
                f"/api/v1/storage/download/{path}",
                headers=test_user["auth_headers"],
            )
            assert dl_resp.status_code == 200, (
                "File should still exist after unauthorized delete attempt by another user"
            )
        finally:
            # Cleanup: User A deletes the file (best-effort)
            integration_client.delete(
                f"/api/v1/storage/delete/{path}",
                headers=test_user["auth_headers"],
            )

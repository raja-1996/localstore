import io
import pytest
from unittest.mock import MagicMock, patch

from tests.conftest import AUTH_HEADERS


def _make_mock_user_sb(signed_url="https://storage.example.com/signed", dict_style=False):
    """
    Build a mock Supabase client for storage tests.

    dict_style=False (default): create_signed_url returns an object with .signed_url attribute.
    dict_style=True:            create_signed_url returns a dict with 'signedURL' key.
    """
    mock_sb = MagicMock()
    if dict_style:
        mock_sb.storage.from_.return_value.create_signed_url.return_value = {"signedURL": signed_url}
    else:
        signed = MagicMock()
        signed.signed_url = signed_url
        mock_sb.storage.from_.return_value.create_signed_url.return_value = signed
    return mock_sb


class TestUploadFile:
    def test_upload_success(self, client):
        mock_sb = _make_mock_user_sb()

        with patch("app.api.v1.storage.get_user_supabase", return_value=mock_sb):
            resp = client.post(
                "/api/v1/storage/upload",
                files={"file": ("test.txt", io.BytesIO(b"hello"), "text/plain")},
                headers=AUTH_HEADERS,
            )

        assert resp.status_code == 200
        data = resp.json()
        assert "path" in data
        assert data["url"] == "https://storage.example.com/signed"
        # Verify the correct bucket name is always used
        mock_sb.storage.from_.assert_called_with("uploads")

    def test_upload_with_custom_path(self, client):
        mock_sb = _make_mock_user_sb()
        custom_path = "user-123/custom/photo.jpg"

        with patch("app.api.v1.storage.get_user_supabase", return_value=mock_sb):
            resp = client.post(
                "/api/v1/storage/upload",
                files={"file": ("photo.jpg", io.BytesIO(b"imgdata"), "image/jpeg")},
                data={"path": custom_path},
                headers=AUTH_HEADERS,
            )

        assert resp.status_code == 200
        assert resp.json()["path"] == custom_path
        assert resp.json()["url"] == "https://storage.example.com/signed"

    def test_upload_storage_error(self, client):
        mock_sb = MagicMock()
        mock_sb.storage.from_.return_value.upload.side_effect = Exception("bucket not found")

        with patch("app.api.v1.storage.get_user_supabase", return_value=mock_sb):
            resp = client.post(
                "/api/v1/storage/upload",
                files={"file": ("test.txt", io.BytesIO(b"data"), "text/plain")},
                headers=AUTH_HEADERS,
            )

        assert resp.status_code == 400

    def test_upload_no_file_extension(self, client):
        mock_sb = _make_mock_user_sb()

        with patch("app.api.v1.storage.get_user_supabase", return_value=mock_sb):
            resp = client.post(
                "/api/v1/storage/upload",
                files={"file": ("noext", io.BytesIO(b"data"), "application/octet-stream")},
                headers=AUTH_HEADERS,
            )

        assert resp.status_code == 200
        # path should end with .bin for files without extension
        assert resp.json()["path"].endswith(".bin")

    def test_upload_signed_url_dict_shape(self, client):
        mock_sb = _make_mock_user_sb("https://storage.example.com/signed-dict", dict_style=True)

        with patch("app.api.v1.storage.get_user_supabase", return_value=mock_sb):
            resp = client.post(
                "/api/v1/storage/upload",
                files={"file": ("test.txt", io.BytesIO(b"hello"), "text/plain")},
                headers=AUTH_HEADERS,
            )

        assert resp.status_code == 200
        assert resp.json()["url"] == "https://storage.example.com/signed-dict"

    def test_upload_signed_url_returns_none(self, client):
        mock_sb = MagicMock()
        signed = MagicMock()
        signed.signed_url = None
        mock_sb.storage.from_.return_value.create_signed_url.return_value = signed

        with patch("app.api.v1.storage.get_user_supabase", return_value=mock_sb):
            resp = client.post(
                "/api/v1/storage/upload",
                files={"file": ("test.txt", io.BytesIO(b"hello"), "text/plain")},
                headers=AUTH_HEADERS,
            )

        assert resp.status_code == 200
        assert resp.json()["url"] == ""

    def test_upload_multi_dot_extension(self, client):
        mock_sb = _make_mock_user_sb()

        with patch("app.api.v1.storage.get_user_supabase", return_value=mock_sb):
            resp = client.post(
                "/api/v1/storage/upload",
                files={"file": ("archive.tar.gz", io.BytesIO(b"data"), "application/gzip")},
                headers=AUTH_HEADERS,
            )

        assert resp.status_code == 200
        # Only the final extension (.gz) should be used, not .tar
        assert resp.json()["path"].endswith(".gz")

    def test_upload_empty_file(self, client):
        mock_sb = _make_mock_user_sb()

        with patch("app.api.v1.storage.get_user_supabase", return_value=mock_sb):
            resp = client.post(
                "/api/v1/storage/upload",
                files={"file": ("empty.txt", io.BytesIO(b""), "text/plain")},
                headers=AUTH_HEADERS,
            )

        assert resp.status_code == 200
        assert "path" in resp.json()
        assert resp.json()["url"] == "https://storage.example.com/signed"

    def test_upload_get_user_supabase_raises(self, client):
        # get_user_supabase is called before the try block in storage.py (line 18),
        # so an exception from it propagates as an unhandled server error.
        # TestClient re-raises unhandled server exceptions by default (raise_server_exceptions=True),
        # which is why pytest.raises is correct here — the production behavior is a 500 to real clients.
        with patch(
            "app.api.v1.storage.get_user_supabase",
            side_effect=Exception("auth error"),
        ):
            with pytest.raises(Exception, match="auth error"):
                client.post(
                    "/api/v1/storage/upload",
                    files={"file": ("test.txt", io.BytesIO(b"hello"), "text/plain")},
                    headers=AUTH_HEADERS,
                )


class TestDownloadFile:
    def test_download_success(self, client):
        mock_sb = _make_mock_user_sb("https://storage.example.com/signed-dl")

        with patch("app.api.v1.storage.get_user_supabase", return_value=mock_sb):
            resp = client.get("/api/v1/storage/download/user-123/photo.jpg", headers=AUTH_HEADERS)

        assert resp.status_code == 200
        assert resp.json()["url"] == "https://storage.example.com/signed-dl"
        # Verify the correct bucket name is always used
        mock_sb.storage.from_.assert_called_with("uploads")

    def test_download_not_found(self, client):
        mock_sb = MagicMock()
        mock_sb.storage.from_.return_value.create_signed_url.side_effect = Exception("not found")

        with patch("app.api.v1.storage.get_user_supabase", return_value=mock_sb):
            resp = client.get("/api/v1/storage/download/missing/file.jpg", headers=AUTH_HEADERS)

        assert resp.status_code == 404

    def test_download_nested_path(self, client):
        mock_sb = _make_mock_user_sb("https://storage.example.com/signed-nested")

        with patch("app.api.v1.storage.get_user_supabase", return_value=mock_sb):
            resp = client.get(
                "/api/v1/storage/download/user-123/nested/deep/file.png",
                headers=AUTH_HEADERS,
            )

        assert resp.status_code == 200
        assert resp.json()["url"] == "https://storage.example.com/signed-nested"

    def test_download_signed_url_dict_shape(self, client):
        mock_sb = _make_mock_user_sb("https://storage.example.com/signed-dl-dict", dict_style=True)

        with patch("app.api.v1.storage.get_user_supabase", return_value=mock_sb):
            resp = client.get("/api/v1/storage/download/user-123/photo.jpg", headers=AUTH_HEADERS)

        assert resp.status_code == 200
        assert resp.json()["url"] == "https://storage.example.com/signed-dl-dict"

    def test_download_signed_url_returns_none(self, client):
        mock_sb = MagicMock()
        signed = MagicMock()
        signed.signed_url = None
        mock_sb.storage.from_.return_value.create_signed_url.return_value = signed

        with patch("app.api.v1.storage.get_user_supabase", return_value=mock_sb):
            resp = client.get("/api/v1/storage/download/user-123/photo.jpg", headers=AUTH_HEADERS)

        assert resp.status_code == 200
        assert resp.json()["url"] == ""


class TestDeleteFile:
    def test_delete_success(self, client):
        mock_sb = MagicMock()

        with patch("app.api.v1.storage.get_user_supabase", return_value=mock_sb):
            resp = client.delete("/api/v1/storage/delete/user-123/photo.jpg", headers=AUTH_HEADERS)

        assert resp.status_code == 204
        mock_sb.storage.from_.assert_called_with("uploads")
        mock_sb.storage.from_.return_value.remove.assert_called_once_with(["user-123/photo.jpg"])

    def test_delete_error(self, client):
        mock_sb = MagicMock()
        mock_sb.storage.from_.return_value.remove.side_effect = Exception("remove error")

        with patch("app.api.v1.storage.get_user_supabase", return_value=mock_sb):
            resp = client.delete("/api/v1/storage/delete/user-123/photo.jpg", headers=AUTH_HEADERS)

        assert resp.status_code == 400

    def test_delete_nested_path(self, client):
        mock_sb = MagicMock()

        with patch("app.api.v1.storage.get_user_supabase", return_value=mock_sb):
            resp = client.delete(
                "/api/v1/storage/delete/a/b/c/file.txt",
                headers=AUTH_HEADERS,
            )

        assert resp.status_code == 204
        mock_sb.storage.from_.return_value.remove.assert_called_once_with(["a/b/c/file.txt"])

import pytest
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient

from tests.conftest import MOCK_USER, AUTH_HEADERS, make_mock_session


def _mock_supabase_with_session(session):
    mock_sb = MagicMock()
    response = MagicMock()
    response.session = session
    response.user = session.user if session else MagicMock()
    mock_sb.auth.sign_up.return_value = response
    mock_sb.auth.sign_in_with_password.return_value = response
    mock_sb.auth.refresh_session.return_value = response
    mock_sb.auth.verify_otp.return_value = response
    return mock_sb


class TestSignup:
    def test_signup_success(self, client):
        session = make_mock_session()
        mock_sb = _mock_supabase_with_session(session)

        with patch("app.api.v1.auth.get_supabase", return_value=mock_sb):
            response = client.post(
                "/api/v1/auth/signup",
                json={"email": "new@example.com", "password": "secret123"},
            )

        assert response.status_code == 200
        data = response.json()
        assert data["access_token"] == "access-abc"
        assert data["token_type"] == "bearer"
        assert data["user"]["email"] == "test@example.com"

    def test_signup_email_confirmation_required(self, client):
        mock_sb = MagicMock()
        response = MagicMock()
        response.session = None
        response.user.id = "user-123"
        mock_sb.auth.sign_up.return_value = response

        with patch("app.api.v1.auth.get_supabase", return_value=mock_sb):
            resp = client.post(
                "/api/v1/auth/signup",
                json={"email": "pending@example.com", "password": "secret123"},
            )

        assert resp.status_code == 200
        data = resp.json()
        assert data["access_token"] == ""
        assert data["expires_in"] == 0

    def test_signup_exception(self, client):
        mock_sb = MagicMock()
        mock_sb.auth.sign_up.side_effect = Exception("Supabase error")

        with patch("app.api.v1.auth.get_supabase", return_value=mock_sb):
            resp = client.post(
                "/api/v1/auth/signup",
                json={"email": "bad@example.com", "password": "x"},
            )

        assert resp.status_code == 400

    def test_signup_invalid_email(self, client):
        resp = client.post(
            "/api/v1/auth/signup",
            json={"email": "not-an-email", "password": "secret123"},
        )
        assert resp.status_code == 422


class TestLogin:
    def test_login_success(self, client):
        session = make_mock_session()
        mock_sb = _mock_supabase_with_session(session)

        with patch("app.api.v1.auth.get_supabase", return_value=mock_sb):
            resp = client.post(
                "/api/v1/auth/login",
                json={"email": "test@example.com", "password": "secret123"},
            )

        assert resp.status_code == 200
        data = resp.json()
        assert data["access_token"] == "access-abc"
        assert data["refresh_token"] == "refresh-xyz"

    def test_login_no_session(self, client):
        mock_sb = MagicMock()
        response = MagicMock()
        response.session = None
        mock_sb.auth.sign_in_with_password.return_value = response

        with patch("app.api.v1.auth.get_supabase", return_value=mock_sb):
            resp = client.post(
                "/api/v1/auth/login",
                json={"email": "test@example.com", "password": "wrong"},
            )

        assert resp.status_code == 401

    def test_login_exception(self, client):
        mock_sb = MagicMock()
        mock_sb.auth.sign_in_with_password.side_effect = Exception("auth error")

        with patch("app.api.v1.auth.get_supabase", return_value=mock_sb):
            resp = client.post(
                "/api/v1/auth/login",
                json={"email": "test@example.com", "password": "wrong"},
            )

        assert resp.status_code == 401


class TestPhoneOTP:
    def test_send_otp_success(self, client):
        mock_sb = MagicMock()

        with patch("app.api.v1.auth.get_supabase", return_value=mock_sb):
            resp = client.post("/api/v1/auth/phone/send-otp", json={"phone": "+1234567890"})

        assert resp.status_code == 200
        assert resp.json()["message"] == "OTP sent successfully"

    def test_send_otp_exception(self, client):
        mock_sb = MagicMock()
        mock_sb.auth.sign_in_with_otp.side_effect = Exception("send error")

        with patch("app.api.v1.auth.get_supabase", return_value=mock_sb):
            resp = client.post("/api/v1/auth/phone/send-otp", json={"phone": "+1234567890"})

        assert resp.status_code == 400

    def test_send_otp_missing_phone(self, client):
        resp = client.post("/api/v1/auth/phone/send-otp", json={})
        assert resp.status_code == 422

    def test_verify_otp_success(self, client):
        session = make_mock_session()
        mock_sb = _mock_supabase_with_session(session)

        with patch("app.api.v1.auth.get_supabase", return_value=mock_sb):
            resp = client.post(
                "/api/v1/auth/phone/verify-otp",
                json={"phone": "+1234567890", "otp": "123456"},
            )

        assert resp.status_code == 200
        assert resp.json()["access_token"] == "access-abc"

    def test_verify_otp_invalid(self, client):
        mock_sb = MagicMock()
        response = MagicMock()
        response.session = None
        mock_sb.auth.verify_otp.return_value = response

        with patch("app.api.v1.auth.get_supabase", return_value=mock_sb):
            resp = client.post(
                "/api/v1/auth/phone/verify-otp",
                json={"phone": "+1234567890", "otp": "000000"},
            )

        assert resp.status_code == 401

    def test_verify_otp_exception(self, client):
        mock_sb = MagicMock()
        mock_sb.auth.verify_otp.side_effect = Exception("otp error")

        with patch("app.api.v1.auth.get_supabase", return_value=mock_sb):
            resp = client.post(
                "/api/v1/auth/phone/verify-otp",
                json={"phone": "+1234567890", "otp": "000000"},
            )

        assert resp.status_code == 401

    def test_verify_otp_phone_user_no_email(self, client):
        session = make_mock_session(email=None, phone="+1234567890")
        mock_sb = _mock_supabase_with_session(session)

        with patch("app.api.v1.auth.get_supabase", return_value=mock_sb):
            resp = client.post(
                "/api/v1/auth/phone/verify-otp",
                json={"phone": "+1234567890", "otp": "123456"},
            )

        assert resp.status_code == 200
        data = resp.json()
        assert data["user"]["phone"] == "+1234567890"
        assert data["user"]["email"] is None
        assert data["access_token"] == "access-abc"
        assert data["refresh_token"] == "refresh-xyz"
        assert data["expires_in"] == 3600


class TestRefresh:
    def test_refresh_success(self, client):
        session = make_mock_session(access_token="new-access", refresh_token="new-refresh")
        mock_sb = _mock_supabase_with_session(session)

        with patch("app.api.v1.auth.get_supabase", return_value=mock_sb):
            resp = client.post("/api/v1/auth/refresh", json={"refresh_token": "old-refresh"})

        assert resp.status_code == 200
        assert resp.json()["access_token"] == "new-access"

    def test_refresh_no_session(self, client):
        mock_sb = MagicMock()
        response = MagicMock()
        response.session = None
        mock_sb.auth.refresh_session.return_value = response

        with patch("app.api.v1.auth.get_supabase", return_value=mock_sb):
            resp = client.post("/api/v1/auth/refresh", json={"refresh_token": "bad-token"})

        assert resp.status_code == 401

    def test_refresh_exception(self, client):
        mock_sb = MagicMock()
        mock_sb.auth.refresh_session.side_effect = Exception("refresh error")

        with patch("app.api.v1.auth.get_supabase", return_value=mock_sb):
            resp = client.post("/api/v1/auth/refresh", json={"refresh_token": "bad-token"})

        assert resp.status_code == 401


class TestLogout:
    def test_logout_success(self, client):
        mock_user_sb = MagicMock()

        with patch("app.core.supabase.get_user_supabase", return_value=mock_user_sb):
            resp = client.post("/api/v1/auth/logout", headers=AUTH_HEADERS)

        assert resp.status_code == 204

    def test_logout_exception_still_succeeds(self, client):
        mock_user_sb = MagicMock()
        mock_user_sb.auth.sign_out.side_effect = Exception("sign out error")

        with patch("app.core.supabase.get_user_supabase", return_value=mock_user_sb):
            resp = client.post("/api/v1/auth/logout", headers=AUTH_HEADERS)

        # logout swallows exceptions
        assert resp.status_code == 204


class TestDeleteAccount:
    def test_delete_account_success(self, client):
        mock_sb = MagicMock()

        with patch("app.api.v1.auth.get_supabase", return_value=mock_sb):
            resp = client.delete("/api/v1/auth/account", headers=AUTH_HEADERS)

        assert resp.status_code == 204
        mock_sb.auth.admin.delete_user.assert_called_once_with(MOCK_USER["id"])

    def test_delete_account_exception(self, client):
        mock_sb = MagicMock()
        mock_sb.auth.admin.delete_user.side_effect = Exception("delete error")

        with patch("app.api.v1.auth.get_supabase", return_value=mock_sb):
            resp = client.delete("/api/v1/auth/account", headers=AUTH_HEADERS)

        assert resp.status_code == 400

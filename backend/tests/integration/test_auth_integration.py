"""
Integration tests for /api/v1/auth endpoints.

These tests require a running Supabase instance and are automatically skipped
when one is not reachable. See tests/integration/conftest.py for setup details.
"""
import os
import uuid
import pytest

from tests.integration.conftest import skip_if_no_supabase, TEST_PASSWORD

TEST_PHONE = "+919182666194"


pytestmark = skip_if_no_supabase


class TestSignupLoginIntegration:
    def test_signup_new_user(self, integration_client):
        """Signing up with a fresh email returns a valid auth response."""
        email = f"signup-{uuid.uuid4().hex[:8]}@gmail.com"
        resp = integration_client.post(
            "/api/v1/auth/signup",
            json={"email": email, "password": TEST_PASSWORD},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["token_type"] == "bearer"
        assert data["user"]["email"] == email

        # Cleanup
        from app.core.supabase import get_supabase
        if data["user"]["id"]:
            try:
                get_supabase().auth.admin.delete_user(data["user"]["id"])
            except Exception:
                pass

    def test_signup_invalid_email(self, integration_client):
        resp = integration_client.post(
            "/api/v1/auth/signup",
            json={"email": "not-an-email", "password": TEST_PASSWORD},
        )
        assert resp.status_code == 422

    def test_login_success(self, integration_client, test_user):
        resp = integration_client.post(
            "/api/v1/auth/login",
            json={"email": test_user["email"], "password": test_user["password"]},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["access_token"]
        assert data["refresh_token"]
        assert data["user"]["email"] == test_user["email"]

    def test_login_wrong_password(self, integration_client, test_user):
        resp = integration_client.post(
            "/api/v1/auth/login",
            json={"email": test_user["email"], "password": "WrongPassword!999"},
        )
        assert resp.status_code == 401

    def test_login_nonexistent_user(self, integration_client):
        resp = integration_client.post(
            "/api/v1/auth/login",
            json={"email": "nobody@example.com", "password": TEST_PASSWORD},
        )
        assert resp.status_code == 401


class TestTokenRefreshIntegration:
    def test_refresh_token(self, integration_client, test_user):
        resp = integration_client.post(
            "/api/v1/auth/refresh",
            json={"refresh_token": test_user["refresh_token"]},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["access_token"]
        # Update the stored token so later tests can still use a valid session
        test_user["access_token"] = data["access_token"]
        test_user["refresh_token"] = data["refresh_token"]
        test_user["auth_headers"] = {"Authorization": f"Bearer {data['access_token']}"}

    def test_refresh_invalid_token(self, integration_client):
        resp = integration_client.post(
            "/api/v1/auth/refresh",
            json={"refresh_token": "totally-invalid-token"},
        )
        assert resp.status_code == 401


class TestProtectedEndpointIntegration:
    def test_missing_authorization_header(self, integration_client):
        resp = integration_client.get("/api/v1/todos")
        assert resp.status_code == 422

    def test_invalid_bearer_token(self, integration_client):
        resp = integration_client.get(
            "/api/v1/todos",
            headers={"Authorization": "Bearer invalid.jwt.token"},
        )
        assert resp.status_code == 401

    def test_malformed_authorization_header(self, integration_client):
        resp = integration_client.get(
            "/api/v1/todos",
            headers={"Authorization": "NotBearer sometoken"},
        )
        assert resp.status_code == 401


class TestPhoneOTPIntegration:
    def test_send_phone_otp(self, integration_client):
        """Sending OTP to a real phone number returns 200. Requires Twilio configured in Supabase."""
        resp = integration_client.post(
            "/api/v1/auth/phone/send-otp",
            json={"phone": TEST_PHONE},
        )
        assert resp.status_code == 200
        assert resp.json()["message"] == "OTP sent successfully"

    def test_verify_phone_otp(self, integration_client):
        """
        Verify OTP received via SMS. Run after test_send_phone_otp.

        Usage:
            TEST_PHONE_OTP=123456 pytest tests/integration/test_auth_integration.py::TestPhoneOTPIntegration::test_verify_phone_otp -v
        """
        otp = os.environ.get("TEST_PHONE_OTP")
        if not otp:
            pytest.skip("Set TEST_PHONE_OTP=<code> to run this test")

        resp = integration_client.post(
            "/api/v1/auth/phone/verify-otp",
            json={"phone": TEST_PHONE, "otp": otp},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["access_token"]
        assert data["refresh_token"]
        assert data["token_type"] == "bearer"
        assert data["user"]["phone"] == TEST_PHONE.lstrip("+")
        assert not data["user"]["email"]  # Supabase returns "" for phone-only users

        # Cleanup — delete the phone user created by OTP verification
        from app.core.supabase import get_supabase
        user_id = data["user"]["id"]
        if user_id:
            try:
                get_supabase().auth.admin.delete_user(user_id)
            except Exception:
                pass


class TestLogoutIntegration:
    def test_logout(self, integration_client, test_user):
        """
        Logout returns 204. We use a fresh login so we don't invalidate the
        session fixture used by other tests.
        """
        login_resp = integration_client.post(
            "/api/v1/auth/login",
            json={"email": test_user["email"], "password": test_user["password"]},
        )
        assert login_resp.status_code == 200
        tmp_token = login_resp.json()["access_token"]

        resp = integration_client.post(
            "/api/v1/auth/logout",
            headers={"Authorization": f"Bearer {tmp_token}"},
        )
        assert resp.status_code == 204

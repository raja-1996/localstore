"""
Unit tests for auth schemas in app/schemas/auth.py.

No HTTP client or Supabase mocking needed — these are pure Pydantic model tests.
"""
import pytest
from pydantic import ValidationError

from app.schemas.auth import AuthResponse, OTPRequest, OTPVerifyRequest, RefreshRequest


class TestOTPRequest:
    def test_valid_indian_phone(self):
        req = OTPRequest(phone="+919876543210")
        assert req.phone == "+919876543210"

    def test_valid_us_phone(self):
        req = OTPRequest(phone="+14155551234")
        assert req.phone == "+14155551234"

    def test_invalid_no_plus(self):
        with pytest.raises(ValidationError):
            OTPRequest(phone="919876543210")

    def test_invalid_plain_digits(self):
        with pytest.raises(ValidationError):
            OTPRequest(phone="12345")

    def test_invalid_alpha(self):
        with pytest.raises(ValidationError):
            OTPRequest(phone="abc")

    def test_invalid_plus_zero_prefix(self):
        with pytest.raises(ValidationError):
            OTPRequest(phone="+0123456789")

    def test_invalid_too_short(self):
        with pytest.raises(ValidationError):
            OTPRequest(phone="+1234")

    def test_valid_minimum_e164(self):
        """Minimum valid E.164: + followed by 7 digits (8 chars total)."""
        req = OTPRequest(phone="+1234567")
        assert req.phone == "+1234567"

    def test_valid_maximum_e164(self):
        """Maximum valid E.164: + followed by 15 digits (16 chars total)."""
        req = OTPRequest(phone="+123456789012345")
        assert req.phone == "+123456789012345"

    def test_invalid_one_too_short(self):
        """One digit below minimum: + followed by 6 digits (7 chars total)."""
        with pytest.raises(ValidationError):
            OTPRequest(phone="+123456")

    def test_invalid_one_too_long(self):
        """One digit above maximum: + followed by 16 digits (17 chars total)."""
        with pytest.raises(ValidationError):
            OTPRequest(phone="+1234567890123456")

    def test_missing_phone_raises(self):
        with pytest.raises(ValidationError):
            OTPRequest()


class TestOTPVerifyRequest:
    def test_valid_phone_and_token(self):
        req = OTPVerifyRequest(phone="+919876543210", token="123456")
        assert req.phone == "+919876543210"
        assert req.token == "123456"

    def test_valid_us_phone_and_token(self):
        req = OTPVerifyRequest(phone="+14155551234", token="654321")
        assert req.phone == "+14155551234"
        assert req.token == "654321"

    def test_invalid_phone_raises(self):
        with pytest.raises(ValidationError):
            OTPVerifyRequest(phone="not-a-phone", token="123456")

    def test_missing_phone_raises(self):
        with pytest.raises(ValidationError):
            OTPVerifyRequest(token="123456")

    def test_missing_token_raises(self):
        with pytest.raises(ValidationError):
            OTPVerifyRequest(phone="+919876543210")

    def test_missing_both_raises(self):
        with pytest.raises(ValidationError):
            OTPVerifyRequest()


class TestRefreshRequest:
    def test_valid_string(self):
        req = RefreshRequest(refresh_token="some-refresh-token-value")
        assert req.refresh_token == "some-refresh-token-value"

    def test_missing_field_raises(self):
        with pytest.raises(ValidationError):
            RefreshRequest()


class TestAuthResponse:
    def test_round_trip_serialization(self):
        data = {
            "access_token": "access-abc",
            "refresh_token": "refresh-xyz",
            "token_type": "bearer",
            "expires_in": 3600,
            "user": {"id": "user-123", "email": "test@example.com"},
        }
        resp = AuthResponse(**data)
        dumped = resp.model_dump()

        assert dumped["access_token"] == "access-abc"
        assert dumped["refresh_token"] == "refresh-xyz"
        assert dumped["token_type"] == "bearer"
        assert dumped["expires_in"] == 3600
        assert dumped["user"]["id"] == "user-123"

    def test_default_token_type(self):
        resp = AuthResponse(
            access_token="a",
            refresh_token="r",
            expires_in=3600,
            user={},
        )
        assert resp.token_type == "bearer"

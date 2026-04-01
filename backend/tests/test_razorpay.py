"""
Unit tests for app/core/razorpay.py — RazorpayClient + verify_webhook_signature.

httpx is mocked via unittest.mock — no real HTTP requests made.
No live Razorpay account required.
"""
import hashlib
import hmac
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest

from app.core.razorpay import RazorpayClient, verify_webhook_signature


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_SECRET = "test_webhook_secret"
_BODY = b'{"event":"payment.captured","payload":{"payment":{"id":"pay_123"}}}'


def _compute_sig(body: bytes, secret: str) -> str:
    """Compute correct HMAC-SHA256 hex digest."""
    return hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()


def _make_mock_response(json_data: dict, status_code: int = 200) -> MagicMock:
    """Build a mock httpx.Response."""
    resp = MagicMock(spec=httpx.Response)
    resp.status_code = status_code
    resp.json.return_value = json_data
    resp.text = str(json_data)
    resp.raise_for_status = MagicMock()
    return resp


def _make_error_response(status_code: int, body: str) -> MagicMock:
    """Build a mock httpx.Response that raises HTTPStatusError."""
    request = MagicMock(spec=httpx.Request)
    resp = MagicMock(spec=httpx.Response)
    resp.status_code = status_code
    resp.text = body
    error = httpx.HTTPStatusError(
        f"{status_code}: {body}", request=request, response=resp
    )
    resp.raise_for_status.side_effect = error
    return resp


# ---------------------------------------------------------------------------
# TestVerifyWebhookSignature
# ---------------------------------------------------------------------------

class TestVerifyWebhookSignature:
    """Tests for verify_webhook_signature()."""

    def test_valid_signature_returns_true(self):
        """Correct HMAC-SHA256 signature returns True."""
        sig = _compute_sig(_BODY, _SECRET)
        assert verify_webhook_signature(_BODY, sig, _SECRET) is True

    def test_invalid_signature_returns_false(self):
        """Wrong signature string returns False."""
        assert verify_webhook_signature(_BODY, "wrong_signature", _SECRET) is False

    def test_empty_signature_returns_false(self):
        """Empty string signature returns False."""
        assert verify_webhook_signature(_BODY, "", _SECRET) is False

    def test_empty_secret_returns_false(self):
        """Empty string secret returns False."""
        sig = _compute_sig(_BODY, "")  # sig computed with empty secret
        assert verify_webhook_signature(_BODY, sig, "") is False

    def test_tampered_body_returns_false(self):
        """Correct sig for original body fails against modified body."""
        sig = _compute_sig(_BODY, _SECRET)
        tampered = _BODY + b"tampered"
        assert verify_webhook_signature(tampered, sig, _SECRET) is False

    def test_secret_as_bytes_returns_true(self):
        """Secret passed as bytes works identically to str secret."""
        sig = _compute_sig(_BODY, _SECRET)
        assert verify_webhook_signature(_BODY, sig, _SECRET.encode()) is True


# ---------------------------------------------------------------------------
# TestRazorpayClient
# ---------------------------------------------------------------------------

class TestRazorpayClient:
    """Tests for RazorpayClient — HTTP methods mocked."""

    @pytest.mark.asyncio
    async def test_create_order_sends_correct_payload(self):
        """create_order POSTs correct amount/currency/receipt payload."""
        resp = _make_mock_response({"id": "order_abc", "amount": 50000})

        client = RazorpayClient(key_id="key", key_secret="secret")
        mock = AsyncMock(return_value=resp)
        with patch.object(client._client, "post", mock):
            result = await client.create_order(
                amount_paise=50000, receipt="receipt_001"
            )
            await client.aclose()

        mock.assert_called_once_with(
            "/orders",
            json={"amount": 50000, "currency": "INR", "receipt": "receipt_001"},
        )
        assert result == {"id": "order_abc", "amount": 50000}

    @pytest.mark.asyncio
    async def test_fetch_payment_uses_correct_url(self):
        """fetch_payment GETs /payments/{payment_id}."""
        resp = _make_mock_response({"id": "pay_123", "status": "captured"})

        client = RazorpayClient(key_id="key", key_secret="secret")
        mock = AsyncMock(return_value=resp)
        with patch.object(client._client, "get", mock):
            result = await client.fetch_payment("pay_123")
            await client.aclose()

        mock.assert_called_once_with("/payments/pay_123")
        assert result == {"id": "pay_123", "status": "captured"}

    @pytest.mark.asyncio
    async def test_refund_with_amount_sends_partial_payload(self):
        """refund() with amount_paise sends {"amount": N} in body."""
        resp = _make_mock_response({"id": "rfnd_001", "amount": 10000})

        client = RazorpayClient(key_id="key", key_secret="secret")
        mock = AsyncMock(return_value=resp)
        with patch.object(client._client, "post", mock):
            result = await client.refund("pay_123", amount_paise=10000)
            await client.aclose()

        mock.assert_called_once_with(
            "/payments/pay_123/refund", json={"amount": 10000}
        )
        assert result["id"] == "rfnd_001"

    @pytest.mark.asyncio
    async def test_refund_without_amount_sends_empty_payload(self):
        """refund() without amount sends empty dict (full refund)."""
        resp = _make_mock_response({"id": "rfnd_002", "amount": 50000})

        client = RazorpayClient(key_id="key", key_secret="secret")
        mock = AsyncMock(return_value=resp)
        with patch.object(client._client, "post", mock):
            result = await client.refund("pay_123")
            await client.aclose()

        mock.assert_called_once_with("/payments/pay_123/refund", json={})
        assert result["id"] == "rfnd_002"

    @pytest.mark.asyncio
    async def test_api_error_raises_http_status_error(self):
        """Non-2xx response raises HTTPStatusError with body text."""
        err_resp = _make_error_response(400, '{"error":{"description":"Bad amount"}}')

        client = RazorpayClient(key_id="key", key_secret="secret")
        with patch.object(client._client, "post", AsyncMock(return_value=err_resp)):
            with pytest.raises(httpx.HTTPStatusError) as exc_info:
                await client.create_order(amount_paise=-1, receipt="r1")
            await client.aclose()

        assert "400" in str(exc_info.value)
        assert "Bad amount" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_context_manager_calls_aclose(self):
        """async with RazorpayClient calls aclose on exit."""
        client = RazorpayClient(key_id="key", key_secret="secret")
        with patch.object(client._client, "aclose", AsyncMock()) as mock_aclose:
            async with client:
                pass
        mock_aclose.assert_called_once()

    @pytest.mark.asyncio
    async def test_create_order_custom_currency(self):
        """create_order with currency='USD' sends 'currency': 'USD' in payload."""
        resp = _make_mock_response({"id": "order_usd", "amount": 1000})

        client = RazorpayClient(key_id="key", key_secret="secret")
        mock = AsyncMock(return_value=resp)
        with patch.object(client._client, "post", mock):
            await client.create_order(amount_paise=1000, receipt="r_usd", currency="USD")
            await client.aclose()

        mock.assert_called_once_with(
            "/orders",
            json={"amount": 1000, "currency": "USD", "receipt": "r_usd"},
        )


# ---------------------------------------------------------------------------
# TestMigrationFile
# ---------------------------------------------------------------------------

class TestMigrationFile:
    """Verify database migration files exist."""

    def test_orders_migration_exists(self):
        """012_orders.sql must exist in supabase/migrations/."""
        repo_root = Path(__file__).resolve().parents[2]
        migration = repo_root / "supabase" / "migrations" / "012_orders.sql"
        assert migration.exists(), f"Migration not found: {migration}"

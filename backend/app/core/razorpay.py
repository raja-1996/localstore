import hashlib
import hmac

import httpx


class RazorpayClient:
    """Thin async wrapper around Razorpay REST API v1."""

    def __init__(
        self,
        key_id: str,
        key_secret: str,
        base_url: str = "https://api.razorpay.com/v1",
        timeout: float = 10.0,
    ) -> None:
        self._client = httpx.AsyncClient(
            base_url=base_url,
            auth=httpx.BasicAuth(key_id, key_secret),
            timeout=timeout,
        )

    async def aclose(self) -> None:
        """Close the underlying HTTP client."""
        await self._client.aclose()

    async def __aenter__(self) -> "RazorpayClient":
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb) -> None:
        await self.aclose()

    async def create_order(
        self,
        amount_paise: int,
        receipt: str,
        currency: str = "INR",
    ) -> dict:
        """POST /orders — create a new Razorpay order."""
        payload = {
            "amount": amount_paise,
            "currency": currency,
            "receipt": receipt,
        }
        response = await self._client.post("/orders", json=payload)
        _raise_for_status(response)
        return response.json()

    async def fetch_payment(self, payment_id: str) -> dict:
        """GET /payments/{payment_id} — retrieve payment details."""
        response = await self._client.get(f"/payments/{payment_id}")
        _raise_for_status(response)
        return response.json()

    async def refund(
        self,
        payment_id: str,
        amount_paise: int | None = None,
    ) -> dict:
        """POST /payments/{payment_id}/refund — full or partial refund."""
        payload = {}
        if amount_paise is not None:
            payload["amount"] = amount_paise
        response = await self._client.post(
            f"/payments/{payment_id}/refund",
            json=payload,
        )
        _raise_for_status(response)
        return response.json()


def _raise_for_status(response: httpx.Response) -> None:
    """Raise HTTPStatusError with Razorpay response body included."""
    try:
        response.raise_for_status()
    except httpx.HTTPStatusError as exc:
        raise httpx.HTTPStatusError(
            f"{exc.response.status_code}: {exc.response.text}",
            request=exc.request,
            response=exc.response,
        ) from exc


def verify_webhook_signature(
    body: bytes,
    signature: str,
    secret: str | bytes,
) -> bool:
    """Return True if signature matches HMAC-SHA256 of body using secret."""
    try:
        if not signature:
            return False
        if not secret:
            return False
        secret_bytes = secret if isinstance(secret, bytes) else secret.encode()
        expected = hmac.new(secret_bytes, body, hashlib.sha256).hexdigest()
        return hmac.compare_digest(expected, signature)
    except (TypeError, ValueError):
        return False

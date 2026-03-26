import logging

import httpx

logger = logging.getLogger(__name__)


async def send_push_notification(token: str, title: str, body: str, data: dict) -> dict:
    payload = {
        "to": token,
        "title": title,
        "body": body,
        "data": data,
        "sound": "default",
    }
    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json",
    }
    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.post(
            "https://exp.host/--/api/v2/push/send",
            json=payload,
            headers=headers,
        )
        response.raise_for_status()
        return response.json()

"""Push notification service — Expo Push API dispatch + token lookup helpers."""
import logging
from typing import Any

import httpx

logger = logging.getLogger(__name__)

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"
BATCH_SIZE = 100  # Expo allows up to 100 per request


async def send_push(
    token: str,
    title: str,
    body: str,
    data: dict[str, Any] | None = None,
) -> dict:
    """Send a single push notification via Expo Push API.

    Args:
        token: Expo push token (e.g., "ExponentPushToken[xxx]")
        title: Notification title
        body: Notification body text
        data: Optional payload (e.g., {"threadId": "...", "screen": "chat"})

    Returns:
        Expo API response dict: {"status": "ok", "id": "..."} or {"status": "error", ...}
    """
    payload = {
        "to": token,
        "title": title,
        "body": body,
        "data": data or {},
        "sound": "default",
    }
    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json",
    }

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(EXPO_PUSH_URL, json=payload, headers=headers)
            resp.raise_for_status()
            result = resp.json()
    except httpx.HTTPError as e:
        logger.error("Expo Push API request failed: %s", e)
        return {"status": "error", "message": str(e)}

    ticket = result.get("data", {})
    if ticket.get("status") == "error":
        details = ticket.get("details", {})
        if details.get("error") == "DeviceNotRegistered":
            logger.warning("Device not registered for token %s", token[:20])
        else:
            logger.warning("Expo push error: %s", ticket)

    return ticket


async def send_bulk_push(
    tokens: list[str],
    title: str,
    body: str,
    data: dict[str, Any] | None = None,
) -> list[dict]:
    """Send push to multiple tokens. Chunks into batches of BATCH_SIZE (100).

    Returns:
        List of Expo API ticket dicts, one per token.
    """
    if not tokens:
        return []

    all_tickets: list[dict] = []
    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json",
    }

    for i in range(0, len(tokens), BATCH_SIZE):
        chunk = tokens[i : i + BATCH_SIZE]
        messages = [
            {
                "to": t,
                "title": title,
                "body": body,
                "data": data or {},
                "sound": "default",
            }
            for t in chunk
        ]

        try:
            async with httpx.AsyncClient() as client:
                resp = await client.post(EXPO_PUSH_URL, json=messages, headers=headers)
                resp.raise_for_status()
                result = resp.json()
        except httpx.HTTPError as e:
            logger.error("Expo bulk push failed for batch %d: %s", i // BATCH_SIZE, e)
            all_tickets.extend(
                {"status": "error", "message": str(e)} for _ in chunk
            )
            continue

        tickets = result.get("data", [])
        all_tickets.extend(tickets)

    return all_tickets


def get_recipient_push_token(supabase, thread_id: str, sender_id: str) -> str | None:
    """Fetch the push_token of the OTHER participant in a chat thread.

    NOTE: sync function (Supabase Python SDK is synchronous).
    Uses service-role Supabase client (passed in).
    """
    try:
        thread_resp = (
            supabase.table("chat_threads")
            .select("user_id, merchant_id, merchants(user_id)")
            .eq("id", thread_id)
            .single()
            .execute()
        )
    except Exception as e:
        logger.warning("Could not fetch thread %s for push token lookup: %s", thread_id, e)
        return None

    if not thread_resp.data:
        return None

    thread = thread_resp.data
    merchant_owner_id = (thread.get("merchants") or {}).get("user_id", "")

    if sender_id == thread["user_id"]:
        recipient_id = merchant_owner_id
    else:
        recipient_id = thread["user_id"]

    if not recipient_id:
        return None

    try:
        profile_resp = (
            supabase.table("profiles")
            .select("push_token")
            .eq("id", recipient_id)
            .single()
            .execute()
        )
    except Exception:
        logger.warning("Could not fetch push_token for user %s", recipient_id)
        return None

    if not profile_resp.data:
        return None

    return profile_resp.data.get("push_token")


def get_sender_name(supabase, sender_id: str) -> str:
    """Fetch sender's full_name from profiles. Returns 'Someone' if not found.

    NOTE: sync function. Called inside background task (not route handler).
    Uses service-role Supabase client (passed in).
    """
    try:
        resp = (
            supabase.table("profiles")
            .select("full_name")
            .eq("id", sender_id)
            .single()
            .execute()
        )
    except Exception:
        logger.warning("Could not fetch sender name for %s", sender_id)
        return "Someone"

    if not resp.data:
        return "Someone"

    return resp.data.get("full_name") or "Someone"


def get_follower_push_tokens(supabase, merchant_id: str) -> list[str]:
    """Fetch push_tokens for all followers of a merchant who have tokens registered.

    NOTE: sync function (Supabase Python SDK is synchronous).
    Uses service-role Supabase client (passed in).
    """
    try:
        follows_resp = (
            supabase.table("follows")
            .select("user_id")
            .eq("merchant_id", merchant_id)
            .execute()
        )
    except Exception:
        logger.warning("Could not fetch followers for merchant %s", merchant_id)
        return []

    user_ids = [r["user_id"] for r in (follows_resp.data or [])]
    if not user_ids:
        return []

    try:
        profiles_resp = (
            supabase.table("profiles")
            .select("id, push_token")
            .in_("id", user_ids)
            .execute()
        )
    except Exception:
        logger.warning("Could not fetch push tokens for followers of %s", merchant_id)
        return []

    return [
        r["push_token"]
        for r in (profiles_resp.data or [])
        if r.get("push_token")
    ]

"""Background push notification tasks — fire-and-forget from route handlers."""
import logging

from app.core.supabase import get_supabase
from app.services import push_service

logger = logging.getLogger(__name__)


async def send_chat_push(thread_id: str, sender_id: str, message_preview: str) -> None:
    """Push notification for a new chat message.

    Fetches recipient token and sender name via service-role client,
    then dispatches via Expo Push API. Runs as a BackgroundTask after
    the HTTP response is sent.
    """
    try:
        supabase = get_supabase()
        token = push_service.get_recipient_push_token(supabase, thread_id, sender_id)
        if not token:
            return

        sender_name = push_service.get_sender_name(supabase, sender_id)
        await push_service.send_push(
            token,
            f"New message from {sender_name}",
            message_preview[:100],
            {"threadId": thread_id, "screen": "chat"},
        )
    except Exception:
        logger.exception("send_chat_push failed for thread %s", thread_id)


async def send_post_push(merchant_id: str, merchant_name: str, post_preview: str) -> None:
    """Push notification to all followers when merchant creates a post.

    Fetches follower tokens via service-role client, then dispatches
    bulk push via Expo Push API. Runs as a BackgroundTask.
    """
    try:
        supabase = get_supabase()
        tokens = push_service.get_follower_push_tokens(supabase, merchant_id)
        if not tokens:
            return

        await push_service.send_bulk_push(
            tokens,
            f"{merchant_name} posted an update",
            post_preview[:100],
            {"merchantId": merchant_id, "screen": "merchant"},
        )
    except Exception:
        logger.exception("send_post_push failed for merchant %s", merchant_id)

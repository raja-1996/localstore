"""Chat routes — threads list, messages (cursor-paginated), send, mark-read."""
import logging

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Response, status

from app.background import push_tasks
from app.core.auth import get_current_user
from app.core.supabase import get_user_supabase
from app.schemas.chat import (
    ChatMessageCreate,
    ChatMessageListResponse,
    ChatMessageResponse,
    ChatThreadCreate,
    ChatThreadListResponse,
    ChatThreadResponse,
    MarkReadResponse,
    MerchantStub,
)

router = APIRouter()
logger = logging.getLogger(__name__)


def _build_thread_response(
    row: dict,
    caller_id: str,
    last_message_map: dict[str, str],
) -> ChatThreadResponse:
    """Build ChatThreadResponse from a Supabase row with joined merchants."""
    merchant_raw = row.get("merchants") or {}
    merchant = MerchantStub(
        id=merchant_raw.get("id", row["merchant_id"]),
        name=merchant_raw.get("name", ""),
        avatar_url=merchant_raw.get("avatar_url"),
    )

    merchant_owner_id = merchant_raw.get("user_id", "")
    if caller_id == merchant_owner_id:
        unread_count = row.get("unread_merchant_count", 0)
    else:
        unread_count = row.get("unread_user_count", 0)

    return ChatThreadResponse(
        id=row["id"],
        user_id=row["user_id"],
        merchant_id=row["merchant_id"],
        merchant=merchant,
        last_message=last_message_map.get(row["id"]),
        last_message_at=row.get("last_message_at"),
        unread_count=unread_count,
        created_at=row["created_at"],
    )


@router.get("/", response_model=ChatThreadListResponse)
async def list_threads(
    limit: int = Query(default=20, ge=1, le=100),
    before: str | None = Query(default=None),
    user: dict = Depends(get_current_user),
):
    """List chat threads for the current user. Ordered by last_message_at DESC."""
    supabase = get_user_supabase(user["token"])

    try:
        query = (
            supabase.table("chat_threads")
            .select(
                "id, user_id, merchant_id, last_message_at,"
                " unread_user_count, unread_merchant_count, created_at,"
                " merchants(id, name, user_id)"
            )
            .order("last_message_at", desc=True)
            .limit(limit + 1)
        )
        if before:
            query = query.lt("last_message_at", before)

        threads_resp = query.execute()
    except Exception:
        logger.exception("Failed to list threads for user %s", user["id"])
        raise HTTPException(status_code=500, detail="Internal server error")

    rows = threads_resp.data or []
    has_more = len(rows) > limit
    if has_more:
        rows = rows[:limit]

    # Batch-fetch last message preview for all thread IDs in one query.
    # Limit to len(thread_ids) * 5 rows to bound the result set; the Python
    # dedup loop below keeps only the first (most recent) message per thread.
    last_message_map: dict[str, str] = {}
    if rows:
        thread_ids = [r["id"] for r in rows]
        try:
            msgs_resp = (
                supabase.table("chat_messages")
                .select("thread_id, content, created_at")
                .in_("thread_id", thread_ids)
                .order("created_at", desc=True)
                .limit(len(thread_ids) * 5)
                .execute()
            )
            # Keep only the first (most recent) message per thread
            for msg in (msgs_resp.data or []):
                tid = msg["thread_id"]
                if tid not in last_message_map:
                    last_message_map[tid] = msg["content"]
        except Exception:
            logger.exception("Failed to batch-fetch last messages")

    caller_id = user["id"]
    data = [_build_thread_response(r, caller_id, last_message_map) for r in rows]
    next_cursor = rows[-1]["last_message_at"] if has_more and rows else None

    return ChatThreadListResponse(data=data, has_more=has_more, next_cursor=next_cursor)


@router.post("/", response_model=ChatThreadResponse, status_code=status.HTTP_201_CREATED)
async def create_thread(
    payload: ChatThreadCreate,
    response: Response,
    user: dict = Depends(get_current_user),
):
    """Start or get existing thread with a merchant. Returns 201 for new, 200 for existing."""
    supabase = get_user_supabase(user["token"])

    # Verify merchant exists
    try:
        merchant_resp = (
            supabase.table("merchants")
            .select("id, name, user_id")
            .eq("id", payload.merchant_id)
            .execute()
        )
    except Exception:
        logger.exception("Failed to check merchant %s", payload.merchant_id)
        raise HTTPException(status_code=500, detail="Internal server error")

    if not merchant_resp.data:
        raise HTTPException(status_code=404, detail="Merchant not found")

    merchant_row = merchant_resp.data[0]

    # Check for existing thread
    try:
        existing_resp = (
            supabase.table("chat_threads")
            .select(
                "id, user_id, merchant_id, last_message_at,"
                " unread_user_count, unread_merchant_count, created_at,"
                " merchants(id, name, user_id)"
            )
            .eq("user_id", user["id"])
            .eq("merchant_id", payload.merchant_id)
            .execute()
        )
    except Exception:
        logger.exception("Failed to check existing thread")
        raise HTTPException(status_code=500, detail="Internal server error")

    if existing_resp.data:
        response.status_code = status.HTTP_200_OK
        return _build_thread_response(existing_resp.data[0], user["id"], {})

    # Insert new thread
    try:
        insert_resp = (
            supabase.table("chat_threads")
            .insert({"user_id": user["id"], "merchant_id": payload.merchant_id})
            .execute()
        )
    except Exception as e:
        msg = str(e).lower()
        # Race condition: another request inserted concurrently
        if "duplicate" in msg or "unique" in msg:
            try:
                fallback_resp = (
                    supabase.table("chat_threads")
                    .select(
                        "id, user_id, merchant_id, last_message_at,"
                        " unread_user_count, unread_merchant_count, created_at,"
                        " merchants(id, name, user_id)"
                    )
                    .eq("user_id", user["id"])
                    .eq("merchant_id", payload.merchant_id)
                    .execute()
                )
            except Exception:
                raise HTTPException(status_code=500, detail="Internal server error")
            if fallback_resp.data:
                response.status_code = status.HTTP_200_OK
                return _build_thread_response(fallback_resp.data[0], user["id"], {})
        logger.exception("Failed to create thread")
        raise HTTPException(status_code=500, detail="Internal server error")

    if not insert_resp.data:
        raise HTTPException(status_code=500, detail="Failed to create thread")

    row = insert_resp.data[0]
    # Inject merchant stub since join not available on raw insert row
    row["merchants"] = merchant_row
    return _build_thread_response(row, user["id"], {})


@router.get("/{thread_id}/messages", response_model=ChatMessageListResponse)
async def list_messages(
    thread_id: str,
    limit: int = Query(default=20, ge=1, le=100),
    before: str | None = Query(default=None),
    user: dict = Depends(get_current_user),
):
    """Cursor-paginated messages for a thread. Ordered by created_at DESC."""
    supabase = get_user_supabase(user["token"])

    # Verify thread participation via RLS: if SELECT returns nothing, caller is not a participant
    try:
        thread_resp = (
            supabase.table("chat_threads")
            .select("id")
            .eq("id", thread_id)
            .execute()
        )
    except Exception:
        logger.exception("Failed to check thread %s", thread_id)
        raise HTTPException(status_code=500, detail="Internal server error")

    if not thread_resp.data:
        raise HTTPException(status_code=403, detail="Thread not found or access denied")

    try:
        query = (
            supabase.table("chat_messages")
            .select(
                "id, thread_id, sender_id, content,"
                " read_by_user, read_by_merchant, created_at"
            )
            .eq("thread_id", thread_id)
            .order("created_at", desc=True)
            .limit(limit + 1)
        )
        if before:
            query = query.lt("created_at", before)

        msgs_resp = query.execute()
    except Exception:
        logger.exception("Failed to list messages for thread %s", thread_id)
        raise HTTPException(status_code=500, detail="Internal server error")

    rows = msgs_resp.data or []
    has_more = len(rows) > limit
    if has_more:
        rows = rows[:limit]

    next_cursor = rows[-1]["created_at"] if has_more and rows else None
    data = [
        ChatMessageResponse(
            id=r["id"],
            thread_id=r["thread_id"],
            sender_id=r["sender_id"],
            content=r["content"],
            read_by_user=r.get("read_by_user", False),
            read_by_merchant=r.get("read_by_merchant", False),
            created_at=r["created_at"],
        )
        for r in rows
    ]

    return ChatMessageListResponse(data=data, has_more=has_more, next_cursor=next_cursor)


@router.post(
    "/{thread_id}/messages",
    response_model=ChatMessageResponse,
    status_code=status.HTTP_201_CREATED,
)
async def send_message(
    thread_id: str,
    payload: ChatMessageCreate,
    bg: BackgroundTasks,
    user: dict = Depends(get_current_user),
):
    """Send a message to a thread. 403 if caller is not a participant."""
    supabase = get_user_supabase(user["token"])

    # Verify thread participation
    try:
        thread_resp = (
            supabase.table("chat_threads")
            .select("id")
            .eq("id", thread_id)
            .execute()
        )
    except Exception:
        logger.exception("Failed to check thread %s", thread_id)
        raise HTTPException(status_code=500, detail="Internal server error")

    if not thread_resp.data:
        raise HTTPException(status_code=403, detail="Thread not found or access denied")

    try:
        insert_resp = (
            supabase.table("chat_messages")
            .insert({
                "thread_id": thread_id,
                "sender_id": user["id"],
                "content": payload.content,
            })
            .execute()
        )
    except Exception as e:
        msg = str(e).lower()
        if "violates row-level security" in msg or "rls" in msg or "policy" in msg:
            raise HTTPException(status_code=403, detail="Not authorized")
        logger.exception("Failed to send message to thread %s", thread_id)
        raise HTTPException(status_code=500, detail="Internal server error")

    if not insert_resp.data:
        raise HTTPException(status_code=500, detail="Failed to send message")

    row = insert_resp.data[0]

    bg.add_task(
        push_tasks.send_chat_push,
        thread_id=thread_id,
        sender_id=user["id"],
        message_preview=payload.content,
    )

    return ChatMessageResponse(
        id=row["id"],
        thread_id=row["thread_id"],
        sender_id=row["sender_id"],
        content=row["content"],
        read_by_user=row.get("read_by_user", False),
        read_by_merchant=row.get("read_by_merchant", False),
        created_at=row["created_at"],
    )


@router.patch("/{thread_id}/read", response_model=MarkReadResponse)
async def mark_read(
    thread_id: str,
    user: dict = Depends(get_current_user),
):
    """Mark all unread messages in a thread as read (caller-perspective)."""
    supabase = get_user_supabase(user["token"])

    # Fetch thread to determine caller role
    try:
        thread_resp = (
            supabase.table("chat_threads")
            .select("id, user_id, merchants(user_id)")
            .eq("id", thread_id)
            .execute()
        )
    except Exception:
        logger.exception("Failed to fetch thread %s", thread_id)
        raise HTTPException(status_code=500, detail="Internal server error")

    if not thread_resp.data:
        raise HTTPException(status_code=403, detail="Thread not found or access denied")

    thread = thread_resp.data[0]
    merchant_raw = thread.get("merchants") or {}
    merchant_owner_id = merchant_raw.get("user_id", "")
    is_merchant_caller = user["id"] == merchant_owner_id

    if is_merchant_caller:
        read_field = "read_by_merchant"
        unread_counter = "unread_merchant_count"
    else:
        read_field = "read_by_user"
        unread_counter = "unread_user_count"

    # Update unread messages
    try:
        update_resp = (
            supabase.table("chat_messages")
            .update({read_field: True})
            .eq("thread_id", thread_id)
            .eq(read_field, False)
            .execute()
        )
    except Exception:
        logger.exception("Failed to mark messages read in thread %s", thread_id)
        raise HTTPException(status_code=500, detail="Internal server error")

    marked_read = len(update_resp.data or [])

    # Reset unread counter on thread
    try:
        supabase.table("chat_threads").update({unread_counter: 0}).eq("id", thread_id).execute()
    except Exception:
        logger.exception("Failed to reset unread counter for thread %s", thread_id)

    return MarkReadResponse(marked_read=marked_read)

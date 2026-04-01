"""Posts routes — CRUD for merchant posts."""
import logging

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Request, status

from app.background import push_tasks
from app.core.auth import get_current_user
from app.core.config import settings
from app.core.supabase import get_user_supabase
from app.schemas.posts import (
    LikeResponse,
    MerchantStub,
    PostCreate,
    PostListResponse,
    PostResponse,
    PostUpdate,
)

router = APIRouter()
logger = logging.getLogger(__name__)


async def _optional_user(request: Request) -> dict | None:
    """Return authenticated user dict or None — never raises 401.

    Respects FastAPI dependency_overrides so unit test fixture works.
    """
    # Honour dependency_overrides (test fixture injects MOCK_USER via get_current_user)
    override = request.app.dependency_overrides.get(get_current_user)
    if override:
        result = override()
        import inspect
        if inspect.isawaitable(result):
            return await result
        return result

    authorization = request.headers.get("Authorization")
    if not authorization or not authorization.startswith("Bearer "):
        return None
    try:
        return await get_current_user(authorization)
    except Exception:
        return None


def _build_post_response(row: dict, liked_ids: set[str]) -> PostResponse:
    """Build a PostResponse from a Supabase row with joined merchants."""
    merchant_raw = row.get("merchants") or {}
    merchant = MerchantStub(
        id=merchant_raw.get("id", row["merchant_id"]),
        name=merchant_raw.get("name", ""),
        avatar_url=None,
    )
    return PostResponse(
        id=row["id"],
        merchant_id=row["merchant_id"],
        merchant=merchant,
        content=row["content"],
        image_url=row.get("image_url"),
        post_type=row["post_type"],
        like_count=row.get("like_count", 0),
        comment_count=row.get("comment_count", 0),
        is_liked_by_me=str(row["id"]) in liked_ids,
        created_at=row["created_at"],
    )


@router.get(
    "/merchants/{merchant_id}/posts",
    response_model=PostListResponse,
)
async def list_posts(
    merchant_id: str,
    limit: int = Query(default=20, ge=1, le=100),
    user: dict | None = Depends(_optional_user),
):
    """List active posts for a merchant. Auth optional — is_liked_by_me requires auth."""
    # Always use get_user_supabase; for anon requests use the publishable key as token
    token = user["token"] if user else settings.supabase_publishable_default_key
    supabase = get_user_supabase(token)

    # Verify merchant exists
    try:
        merchant_resp = (
            supabase.table("merchants")
            .select("id")
            .eq("id", merchant_id)
            .single()
            .execute()
        )
    except Exception:
        logger.exception("Failed to check merchant existence %s", merchant_id)
        raise HTTPException(status_code=500, detail="Internal server error")

    if not merchant_resp.data:
        raise HTTPException(status_code=404, detail="Merchant not found")

    # Fetch posts
    try:
        posts_resp = (
            supabase.table("posts")
            .select(
                "id, merchant_id, content, post_type, image_url,"
                " like_count, comment_count, created_at,"
                " merchants(id, name)",
                count="exact",
            )
            .eq("merchant_id", merchant_id)
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )
    except Exception:
        logger.exception("Failed to fetch posts for merchant %s", merchant_id)
        raise HTTPException(status_code=500, detail="Internal server error")

    rows = posts_resp.data or []

    # Resolve is_liked_by_me for authenticated callers
    liked_ids: set[str] = set()
    if user and rows:
        post_ids = [str(r["id"]) for r in rows]
        try:
            likes_resp = (
                supabase.table("likes")
                .select("post_id")
                .eq("user_id", user["id"])
                .in_("post_id", post_ids)
                .execute()
            )
            liked_ids = {str(r["post_id"]) for r in (likes_resp.data or [])}
        except Exception:
            logger.exception("Failed to fetch likes for user %s", user["id"])

    return PostListResponse(
        data=[_build_post_response(r, liked_ids) for r in rows],
        count=posts_resp.count or len(rows),
    )


@router.post(
    "/merchants/{merchant_id}/posts",
    response_model=PostResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_post(
    merchant_id: str,
    payload: PostCreate,
    bg: BackgroundTasks,
    user: dict = Depends(get_current_user),
):
    """Create a post. 403 if caller is not merchant owner (RLS)."""
    supabase = get_user_supabase(user["token"])

    insert_data: dict = {
        "merchant_id": merchant_id,
        "content": payload.content,
        "post_type": payload.post_type,
    }
    if payload.image_url is not None:
        insert_data["image_url"] = payload.image_url
    if payload.service_id is not None:
        insert_data["service_id"] = payload.service_id

    try:
        response = (
            supabase.table("posts")
            .insert(insert_data)
            .execute()
        )
    except Exception as e:
        msg = str(e).lower()
        if "violates row-level security" in msg or "rls" in msg or "policy" in msg:
            raise HTTPException(status_code=403, detail="Not authorized to post for this merchant")
        logger.exception("Failed to create post for merchant %s", merchant_id)
        raise HTTPException(status_code=500, detail="Internal server error")

    if not response.data:
        raise HTTPException(status_code=403, detail="Not authorized to post for this merchant")

    row = response.data[0]

    # Re-fetch with joined merchant for response
    try:
        fetch_resp = (
            supabase.table("posts")
            .select(
                "id, merchant_id, content, post_type, image_url,"
                " like_count, comment_count, created_at,"
                " merchants(id, name)"
            )
            .eq("id", row["id"])
            .single()
            .execute()
        )
    except Exception:
        logger.exception("Failed to fetch created post %s", row["id"])
        raise HTTPException(status_code=500, detail="Internal server error")

    # Push notification to followers
    merchant_name = fetch_resp.data.get("merchants", {}).get("name", "")
    if merchant_name:
        bg.add_task(
            push_tasks.send_post_push,
            merchant_id=merchant_id,
            merchant_name=merchant_name,
            post_preview=payload.content,
        )

    return _build_post_response(fetch_resp.data, set())


@router.patch(
    "/merchants/{merchant_id}/posts/{post_id}",
    response_model=PostResponse,
)
async def update_post(
    merchant_id: str,
    post_id: str,
    payload: PostUpdate,
    user: dict = Depends(get_current_user),
):
    """Update own post. 403 if not the merchant owner."""
    supabase = get_user_supabase(user["token"])

    update_data = payload.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(status_code=422, detail="No fields provided for update")

    try:
        response = (
            supabase.table("posts")
            .update(update_data)
            .eq("id", post_id)
            .eq("merchant_id", merchant_id)
            .execute()
        )
    except Exception:
        logger.exception("Failed to update post %s", post_id)
        raise HTTPException(status_code=500, detail="Internal server error")

    if not response.data:
        raise HTTPException(status_code=403, detail="Post not found or not authorized")

    # Re-fetch with joined merchant for response
    try:
        fetch_resp = (
            supabase.table("posts")
            .select(
                "id, merchant_id, content, post_type, image_url,"
                " like_count, comment_count, created_at,"
                " merchants(id, name)"
            )
            .eq("id", post_id)
            .single()
            .execute()
        )
    except Exception:
        logger.exception("Failed to fetch updated post %s", post_id)
        raise HTTPException(status_code=500, detail="Internal server error")

    return _build_post_response(fetch_resp.data, set())


@router.delete(
    "/merchants/{merchant_id}/posts/{post_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_post(
    merchant_id: str,
    post_id: str,
    user: dict = Depends(get_current_user),
):
    """Soft-delete a post (is_active=false). 403 if not the merchant owner."""
    supabase = get_user_supabase(user["token"])

    try:
        response = (
            supabase.table("posts")
            .update({"is_active": False})
            .eq("id", post_id)
            .eq("merchant_id", merchant_id)
            .execute()
        )
    except Exception:
        logger.exception("Failed to soft-delete post %s", post_id)
        raise HTTPException(status_code=500, detail="Internal server error")

    if not response.data:
        raise HTTPException(status_code=403, detail="Post not found or not authorized")

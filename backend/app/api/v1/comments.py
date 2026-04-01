"""Comments routes — CRUD for post comments."""
import logging

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.auth import get_current_user
from app.core.supabase import get_user_supabase
from app.schemas.comments import (
    CommentCreate,
    CommentListResponse,
    CommentResponse,
    CommentUpdate,
    UserStub,
)

router = APIRouter()
logger = logging.getLogger(__name__)


def _build_comment_response(row: dict) -> CommentResponse:
    """Build a CommentResponse from a Supabase row with joined profiles."""
    profile = row.get("profiles") or {}
    user = UserStub(
        id=profile.get("id", row.get("user_id")),
        full_name=profile.get("full_name"),
        avatar_url=profile.get("avatar_url"),
    )
    return CommentResponse(
        id=row["id"],
        post_id=row["post_id"],
        user=user,
        content=row["content"],
        created_at=row["created_at"],
    )


@router.get(
    "/posts/{post_id}/comments",
    response_model=CommentListResponse,
)
async def list_comments(
    post_id: str,
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    user: dict = Depends(get_current_user),
):
    """List comments for a post, paginated."""
    supabase = get_user_supabase(user["token"])

    try:
        resp = (
            supabase.table("comments")
            .select(
                "id, post_id, user_id, content, created_at,"
                " profiles(id, full_name, avatar_url)",
                count="exact",
            )
            .eq("post_id", post_id)
            .order("created_at", desc=False)
            .limit(limit)
            .offset(offset)
            .execute()
        )
    except Exception:
        logger.exception("Failed to fetch comments for post %s", post_id)
        raise HTTPException(status_code=500, detail="Internal server error")

    rows = resp.data or []

    return CommentListResponse(
        data=[_build_comment_response(r) for r in rows],
        count=resp.count or len(rows),
    )


@router.post(
    "/posts/{post_id}/comments",
    response_model=CommentResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_comment(
    post_id: str,
    payload: CommentCreate,
    user: dict = Depends(get_current_user),
):
    """Create a comment on a post."""
    supabase = get_user_supabase(user["token"])

    insert_data = {
        "post_id": post_id,
        "user_id": user["id"],
        "content": payload.content,
    }

    try:
        response = (
            supabase.table("comments")
            .insert(insert_data)
            .execute()
        )
    except Exception:
        logger.exception("Failed to create comment on post %s", post_id)
        raise HTTPException(status_code=500, detail="Internal server error")

    if not response.data:
        raise HTTPException(status_code=500, detail="Internal server error")

    row = response.data[0]

    # Re-fetch with joined profile for response
    try:
        fetch_resp = (
            supabase.table("comments")
            .select("id, post_id, user_id, content, created_at, profiles(id, full_name, avatar_url)")
            .eq("id", row["id"])
            .single()
            .execute()
        )
    except Exception:
        logger.exception("Failed to fetch created comment %s", row["id"])
        raise HTTPException(status_code=500, detail="Internal server error")

    return _build_comment_response(fetch_resp.data)


@router.patch(
    "/posts/{post_id}/comments/{comment_id}",
    response_model=CommentResponse,
)
async def update_comment(
    post_id: str,
    comment_id: str,
    payload: CommentUpdate,
    user: dict = Depends(get_current_user),
):
    """Update own comment. 403 if caller is not the comment author."""
    supabase = get_user_supabase(user["token"])

    try:
        response = (
            supabase.table("comments")
            .update({"content": payload.content})
            .eq("id", comment_id)
            .eq("post_id", post_id)
            .eq("user_id", user["id"])
            .execute()
        )
    except Exception:
        logger.exception("Failed to update comment %s", comment_id)
        raise HTTPException(status_code=500, detail="Internal server error")

    if not response.data:
        raise HTTPException(status_code=403, detail="Comment not found or not your comment")

    # Re-fetch with joined profile for response
    try:
        fetch_resp = (
            supabase.table("comments")
            .select("id, post_id, user_id, content, created_at, profiles(id, full_name, avatar_url)")
            .eq("id", comment_id)
            .single()
            .execute()
        )
    except Exception:
        logger.exception("Failed to fetch updated comment %s", comment_id)
        raise HTTPException(status_code=500, detail="Internal server error")

    return _build_comment_response(fetch_resp.data)


@router.delete(
    "/posts/{post_id}/comments/{comment_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_comment(
    post_id: str,
    comment_id: str,
    user: dict = Depends(get_current_user),
):
    """Delete own comment. 403 if caller is not the comment author."""
    supabase = get_user_supabase(user["token"])

    try:
        response = (
            supabase.table("comments")
            .delete()
            .eq("id", comment_id)
            .eq("post_id", post_id)
            .eq("user_id", user["id"])
            .execute()
        )
    except Exception:
        logger.exception("Failed to delete comment %s", comment_id)
        raise HTTPException(status_code=500, detail="Internal server error")

    if not response.data:
        raise HTTPException(status_code=403, detail="Comment not found or not your comment")

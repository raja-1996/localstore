"""Likes routes — like/unlike posts."""
import logging

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.auth import get_current_user
from app.core.supabase import get_user_supabase
from app.schemas.posts import LikeResponse

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post(
    "/posts/{post_id}/like",
    response_model=LikeResponse,
    status_code=status.HTTP_201_CREATED,
)
async def like_post(
    post_id: str,
    user: dict = Depends(get_current_user),
):
    """Like a post. 409 if already liked."""
    supabase = get_user_supabase(user["token"])

    insert_data = {
        "post_id": post_id,
        "user_id": user["id"],
    }

    try:
        response = (
            supabase.table("likes")
            .insert(insert_data)
            .execute()
        )
    except Exception as e:
        msg = str(e).lower()
        if "duplicate" in msg or "unique" in msg or "already" in msg:
            raise HTTPException(status_code=409, detail="Already liked this post")
        logger.exception("Failed to like post %s", post_id)
        raise HTTPException(status_code=500, detail="Internal server error")

    if not response.data:
        raise HTTPException(status_code=500, detail="Internal server error")

    return LikeResponse(liked=True)


@router.delete(
    "/posts/{post_id}/like",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def unlike_post(
    post_id: str,
    user: dict = Depends(get_current_user),
):
    """Unlike a post. 404 if not liked."""
    supabase = get_user_supabase(user["token"])

    try:
        response = (
            supabase.table("likes")
            .delete()
            .eq("post_id", post_id)
            .eq("user_id", user["id"])
            .execute()
        )
    except Exception:
        logger.exception("Failed to unlike post %s", post_id)
        raise HTTPException(status_code=500, detail="Internal server error")

    if not response.data:
        raise HTTPException(status_code=404, detail="Like not found")

"""Follows routes — follow/unfollow merchants, follower/following lists, following feed."""
import logging

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.auth import get_current_user
from app.core.supabase import get_user_supabase
from app.schemas.follows import (
    FollowResponse,
    FollowerListResponse,
    FollowingFeedResponse,
    FollowingFeedPost,
    FollowingListResponse,
    PostMerchantStub,
    ProfileStub,
)
from app.schemas.merchants import MerchantCard

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post(
    "/merchants/{merchant_id}/follow",
    response_model=FollowResponse,
    status_code=status.HTTP_201_CREATED,
)
async def follow_merchant(
    merchant_id: str,
    user: dict = Depends(get_current_user),
):
    """Follow a merchant. 409 if already following."""
    supabase = get_user_supabase(user["token"])
    try:
        response = (
            supabase.table("follows")
            .insert({"follower_id": user["id"], "merchant_id": merchant_id})
            .execute()
        )
    except Exception as e:
        msg = str(e).lower()
        if "duplicate" in msg or "unique" in msg or "already" in msg:
            raise HTTPException(status_code=409, detail="Already following this merchant")
        raise HTTPException(status_code=500, detail="Internal server error")

    if not response.data:
        raise HTTPException(status_code=400, detail="Failed to follow merchant")

    row = response.data[0]
    return FollowResponse(
        merchant_id=row["merchant_id"],
        followed_at=row["created_at"],
    )


@router.delete(
    "/merchants/{merchant_id}/follow",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def unfollow_merchant(
    merchant_id: str,
    user: dict = Depends(get_current_user),
):
    """Unfollow a merchant. 404 if not following."""
    supabase = get_user_supabase(user["token"])
    try:
        response = (
            supabase.table("follows")
            .delete()
            .eq("follower_id", user["id"])
            .eq("merchant_id", merchant_id)
            .execute()
        )
    except Exception:
        raise HTTPException(status_code=500, detail="Internal server error")

    if not response.data:
        raise HTTPException(status_code=404, detail="Not following this merchant")


@router.get("/merchants/{merchant_id}/followers", response_model=FollowerListResponse)
async def get_followers(
    merchant_id: str,
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    user: dict = Depends(get_current_user),
):
    """List followers of a merchant with profile stubs."""
    supabase = get_user_supabase(user["token"])
    try:
        # count="exact" returns total in response.count without a second round-trip
        response = (
            supabase.table("follows")
            .select("follower_id, profiles(id, full_name, avatar_url)", count="exact")
            .eq("merchant_id", merchant_id)
            .limit(limit)
            .offset(offset)
            .execute()
        )
    except Exception:
        raise HTTPException(status_code=500, detail="Internal server error")

    rows = response.data or []
    stubs = []
    for row in rows:
        profile = row.get("profiles") or {}
        stubs.append(ProfileStub(
            id=profile.get("id", row["follower_id"]),
            display_name=profile.get("full_name"),
            avatar_url=profile.get("avatar_url"),
        ))

    return FollowerListResponse(data=stubs, count=response.count or 0)


@router.get("/users/me/following", response_model=FollowingListResponse)
async def get_following(user: dict = Depends(get_current_user)):
    """Return all merchants the current user follows as merchant cards."""
    supabase = get_user_supabase(user["token"])
    try:
        # count="exact" gives the true total without a second round-trip
        response = (
            supabase.table("follows")
            .select(
                "merchant_id,"
                " merchants(id, name, category, avg_rating, review_count, follower_count, is_verified)",
                count="exact",
            )
            .eq("follower_id", user["id"])
            .execute()
        )
    except Exception:
        raise HTTPException(status_code=500, detail="Internal server error")

    rows = response.data or []
    cards = []
    for row in rows:
        m = row.get("merchants") or {}
        cards.append(MerchantCard(
            id=m.get("id", row["merchant_id"]),
            name=m.get("name", ""),
            category=m.get("category", "Other"),
            lat=0.0,
            lng=0.0,
            avg_rating=m.get("avg_rating", 0),
            review_count=m.get("review_count", 0),
            follower_count=m.get("follower_count", 0),
            is_verified=m.get("is_verified", False),
            distance_meters=None,
        ))

    return FollowingListResponse(data=cards, count=response.count or 0)


@router.get("/feed/following", response_model=FollowingFeedResponse)
async def feed_following(
    limit: int = Query(default=20, ge=1, le=100),
    before: str | None = Query(default=None),
    user: dict = Depends(get_current_user),
):
    """Cursor-paginated posts from merchants the current user follows.

    Cursor is an ISO-8601 created_at string from the last item of the previous page.
    Items ordered by created_at DESC.
    """
    supabase = get_user_supabase(user["token"])

    try:
        # Fetch followed merchant IDs
        follows_resp = (
            supabase.table("follows")
            .select("merchant_id")
            .eq("follower_id", user["id"])
            .execute()
        )
    except Exception:
        logger.exception("Failed to fetch follows for user %s", user["id"])
        raise HTTPException(status_code=500, detail="Internal server error")

    merchant_ids = [row["merchant_id"] for row in (follows_resp.data or [])]
    if not merchant_ids:
        return FollowingFeedResponse(data=[], has_more=False, next_cursor=None)

    try:
        # Two round-trips (follows then posts) is intentional: Supabase PostgREST does not
        # support filtering a join table with an .in_() on a nested relation cleanly.
        # Fetch limit+1 posts so we can determine has_more.
        # NOTE: merchants.avatar_url does not exist yet; the join returns null until
        # a future migration adds the column.  PostMerchantStub.avatar_url is nullable.
        query = (
            supabase.table("posts")
            .select(
                "id, merchant_id, content, image_url, post_type, like_count, comment_count, created_at,"
                " merchants(id, name)"
            )
            .in_("merchant_id", merchant_ids)
            .eq("is_active", True)
            .order("created_at", desc=True)
            .limit(limit + 1)
        )
        if before:
            query = query.lt("created_at", before)

        posts_resp = query.execute()
    except Exception:
        logger.exception("Failed to fetch following feed for user %s", user["id"])
        raise HTTPException(status_code=500, detail="Internal server error")

    rows = posts_resp.data or []
    has_more = len(rows) > limit
    if has_more:
        rows = rows[:limit]

    posts = []
    for row in rows:
        m = row.get("merchants") or {}
        posts.append(FollowingFeedPost(
            id=str(row["id"]),
            merchant=PostMerchantStub(
                id=str(m.get("id", row["merchant_id"])),
                business_name=m.get("name", ""),
                avatar_url=None,
            ),
            content=row["content"],
            image_url=row.get("image_url"),
            post_type=row.get("post_type", "update"),
            like_count=row.get("like_count", 0),
            comment_count=row.get("comment_count", 0),
            created_at=row["created_at"],
        ))

    next_cursor = posts[-1].created_at.isoformat() if has_more and posts else None

    return FollowingFeedResponse(data=posts, has_more=has_more, next_cursor=next_cursor)

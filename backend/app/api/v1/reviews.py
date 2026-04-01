"""Reviews routes — CRUD for merchant reviews."""
import logging

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.auth import get_current_user
from app.core.supabase import get_user_supabase
from app.schemas.reviews import (
    ReviewCreate,
    ReviewListResponse,
    ReviewResponse,
    ReviewerStub,
    ReviewUpdate,
)

router = APIRouter()
logger = logging.getLogger(__name__)


def _build_review_response(row: dict) -> ReviewResponse:
    """Build a ReviewResponse from a Supabase row with joined profiles."""
    profile = row.get("profiles") or {}
    reviewer = ReviewerStub(
        id=profile.get("id", row["reviewer_id"]),
        full_name=profile.get("full_name"),
        avatar_url=profile.get("avatar_url"),
    )
    return ReviewResponse(
        id=row["id"],
        merchant_id=row["merchant_id"],
        reviewer=reviewer,
        rating=row["rating"],
        body=row.get("body"),
        is_verified_purchase=False,
        created_at=row["created_at"],
    )


@router.get(
    "/merchants/{merchant_id}/reviews",
    response_model=ReviewListResponse,
)
async def list_reviews(
    merchant_id: str,
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    user: dict = Depends(get_current_user),
):
    """List reviews for a merchant with avg_rating and total count."""
    supabase = get_user_supabase(user["token"])

    try:
        reviews_resp = (
            supabase.table("reviews")
            .select(
                "id, merchant_id, reviewer_id, rating, body, created_at,"
                " profiles(id, full_name, avatar_url)",
                count="exact",
            )
            .eq("merchant_id", merchant_id)
            .order("created_at", desc=True)
            .limit(limit)
            .offset(offset)
            .execute()
        )
    except Exception:
        logger.exception("Failed to fetch reviews for merchant %s", merchant_id)
        raise HTTPException(status_code=500, detail="Internal server error")

    try:
        merchant_resp = (
            supabase.table("merchants")
            .select("avg_rating")
            .eq("id", merchant_id)
            .single()
            .execute()
        )
    except Exception:
        logger.exception("Failed to fetch merchant avg_rating for %s", merchant_id)
        raise HTTPException(status_code=500, detail="Internal server error")

    rows = reviews_resp.data or []
    avg_rating = float(merchant_resp.data.get("avg_rating") or 0)

    return ReviewListResponse(
        data=[_build_review_response(r) for r in rows],
        avg_rating=avg_rating,
        count=reviews_resp.count or 0,
    )


@router.post(
    "/merchants/{merchant_id}/reviews",
    response_model=ReviewResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_review(
    merchant_id: str,
    payload: ReviewCreate,
    user: dict = Depends(get_current_user),
):
    """Create a review. 409 on duplicate. 403 on self-review (blocked by RLS)."""
    supabase = get_user_supabase(user["token"])

    insert_data = {
        "merchant_id": merchant_id,
        "reviewer_id": user["id"],
        "rating": payload.rating,
    }
    if payload.body is not None:
        insert_data["body"] = payload.body

    try:
        response = (
            supabase.table("reviews")
            .insert(insert_data)
            .execute()
        )
    except Exception as e:
        msg = str(e).lower()
        if "duplicate" in msg or "unique" in msg or "already" in msg:
            raise HTTPException(status_code=409, detail="Review already exists for this merchant")
        if "violates row-level security" in msg or "rls" in msg or "policy" in msg:
            raise HTTPException(status_code=403, detail="Cannot review your own merchant")
        logger.exception("Failed to create review for merchant %s", merchant_id)
        raise HTTPException(status_code=500, detail="Internal server error")

    if not response.data:
        raise HTTPException(status_code=403, detail="Cannot review your own merchant")

    row = response.data[0]

    # Re-fetch with joined profile for the response
    try:
        fetch_resp = (
            supabase.table("reviews")
            .select("id, merchant_id, reviewer_id, rating, body, created_at, profiles(id, full_name, avatar_url)")
            .eq("id", row["id"])
            .single()
            .execute()
        )
    except Exception:
        logger.exception("Failed to fetch created review %s", row["id"])
        raise HTTPException(status_code=500, detail="Internal server error")

    return _build_review_response(fetch_resp.data)


@router.patch(
    "/merchants/{merchant_id}/reviews/{review_id}",
    response_model=ReviewResponse,
)
async def update_review(
    merchant_id: str,
    review_id: str,
    payload: ReviewUpdate,
    user: dict = Depends(get_current_user),
):
    """Update own review. 403 if not the reviewer."""
    supabase = get_user_supabase(user["token"])

    update_data = payload.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(status_code=422, detail="No fields provided for update")

    try:
        response = (
            supabase.table("reviews")
            .update(update_data)
            .eq("id", review_id)
            .eq("merchant_id", merchant_id)
            .eq("reviewer_id", user["id"])
            .execute()
        )
    except Exception:
        logger.exception("Failed to update review %s", review_id)
        raise HTTPException(status_code=500, detail="Internal server error")

    if not response.data:
        raise HTTPException(status_code=403, detail="Review not found or not your review")

    # Re-fetch with joined profile
    try:
        fetch_resp = (
            supabase.table("reviews")
            .select("id, merchant_id, reviewer_id, rating, body, created_at, profiles(id, full_name, avatar_url)")
            .eq("id", review_id)
            .single()
            .execute()
        )
    except Exception:
        logger.exception("Failed to fetch updated review %s", review_id)
        raise HTTPException(status_code=500, detail="Internal server error")

    return _build_review_response(fetch_resp.data)


@router.delete(
    "/merchants/{merchant_id}/reviews/{review_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_review(
    merchant_id: str,
    review_id: str,
    user: dict = Depends(get_current_user),
):
    """Delete own review. 403 if not the reviewer."""
    supabase = get_user_supabase(user["token"])

    try:
        response = (
            supabase.table("reviews")
            .delete()
            .eq("id", review_id)
            .eq("merchant_id", merchant_id)
            .eq("reviewer_id", user["id"])
            .execute()
        )
    except Exception:
        logger.exception("Failed to delete review %s", review_id)
        raise HTTPException(status_code=500, detail="Internal server error")

    if not response.data:
        raise HTTPException(status_code=403, detail="Review not found or not your review")

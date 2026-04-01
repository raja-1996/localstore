from fastapi import APIRouter, Depends, HTTPException, status
from app.core.auth import get_current_user
from app.core.supabase import get_user_supabase
from app.schemas.portfolio import PortfolioImageCreate, PortfolioImageResponse, ReorderRequest
from app.api.v1.deps import check_merchant_owner

router = APIRouter()

MAX_PORTFOLIO_IMAGES = 10


@router.get(
    "/merchants/{merchant_id}/portfolio",
    response_model=list[PortfolioImageResponse],
)
async def list_portfolio(
    merchant_id: str, user: dict = Depends(get_current_user)
):
    supabase = get_user_supabase(user["token"])
    try:
        response = (
            supabase.table("portfolio_images")
            .select("*")
            .eq("merchant_id", merchant_id)
            .order("sort_order")
            .execute()
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    return response.data


@router.post(
    "/merchants/{merchant_id}/portfolio",
    response_model=PortfolioImageResponse,
    status_code=status.HTTP_201_CREATED,
)
async def add_portfolio_image(
    merchant_id: str,
    data: PortfolioImageCreate,
    user: dict = Depends(get_current_user),
):
    supabase = get_user_supabase(user["token"])
    check_merchant_owner(supabase, merchant_id, user["id"])

    try:
        count_response = (
            supabase.table("portfolio_images")
            .select("id", count="exact")
            .eq("merchant_id", merchant_id)
            .execute()
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Note: TOCTOU race condition possible; enforce max-10 at DB level in production
    if (count_response.count or 0) >= MAX_PORTFOLIO_IMAGES:
        raise HTTPException(
            status_code=400,
            detail=f"Portfolio limit reached ({MAX_PORTFOLIO_IMAGES} images max)",
        )

    payload = data.model_dump()
    payload["merchant_id"] = merchant_id

    try:
        response = supabase.table("portfolio_images").insert(payload).execute()
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    if not response.data:
        raise HTTPException(status_code=400, detail="Failed to add portfolio image")
    return response.data[0]


# NOTE: /reorder MUST be registered before /{image_id} to avoid route collision
@router.patch(
    "/merchants/{merchant_id}/portfolio/reorder",
    status_code=status.HTTP_200_OK,
)
async def reorder_portfolio(
    merchant_id: str,
    data: ReorderRequest,
    user: dict = Depends(get_current_user),
):
    supabase = get_user_supabase(user["token"])
    check_merchant_owner(supabase, merchant_id, user["id"])

    try:
        existing_response = (
            supabase.table("portfolio_images")
            .select("id")
            .eq("merchant_id", merchant_id)
            .execute()
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail="Internal server error")

    existing_ids = {row["id"] for row in existing_response.data}
    unknown_ids = [img_id for img_id in data.order if img_id not in existing_ids]
    if unknown_ids:
        raise HTTPException(status_code=400, detail="Invalid image IDs in reorder request")

    # Update sort_order only — avoids upsert risk of inserting rows with missing required fields.
    # Portfolio reorder is typically <10 items so sequential updates are acceptable.
    try:
        for i, img_id in enumerate(data.order):
            supabase.table("portfolio_images").update({"sort_order": i}).eq(
                "id", img_id
            ).eq("merchant_id", merchant_id).execute()
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    return {"reordered": len(data.order)}


@router.delete(
    "/merchants/{merchant_id}/portfolio/{image_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_portfolio_image(
    merchant_id: str,
    image_id: str,
    user: dict = Depends(get_current_user),
):
    supabase = get_user_supabase(user["token"])
    check_merchant_owner(supabase, merchant_id, user["id"])

    try:
        response = (
            supabase.table("portfolio_images")
            .delete()
            .eq("id", image_id)
            .eq("merchant_id", merchant_id)
            .execute()
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    if not response.data:
        raise HTTPException(status_code=404, detail="Portfolio image not found")

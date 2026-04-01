from fastapi import APIRouter, Depends, HTTPException, Query, status
from app.core.auth import get_current_user
from app.core.supabase import get_user_supabase
from app.schemas.merchants import MerchantCard, MerchantCreate, MerchantDetail, MerchantUpdate
from app.api.v1.deps import check_merchant_owner
from app.services import geo

router = APIRouter()


def _row_to_detail(row: dict, is_owner: bool = False, is_following: bool = False) -> MerchantDetail:
    """Convert a Supabase row to MerchantDetail.

    PostGIS location column returns as hex-encoded EWKB — lat/lng set to 0.0 placeholder.
    Sprint 3 feed query will compute real distance via ST_Distance.
    is_owner=True: phone/whatsapp stay unmasked (is_owner field skips masking validator).
    is_owner=False: _mask_contact_fields validator masks phone/whatsapp.
    """
    # Supabase PostGIS returns location as hex-encoded EWKB; skip parsing for now
    row_copy = {**row, "lat": 0.0, "lng": 0.0, "is_owner": is_owner, "is_following": is_following}
    return MerchantDetail.model_validate(row_copy)


# NOTE: /me MUST be registered before /{merchant_id} — FastAPI matches in order
@router.get("/me", response_model=MerchantDetail)
async def get_own_merchant(user: dict = Depends(get_current_user)):
    supabase = get_user_supabase(user["token"])
    try:
        response = (
            supabase.table("merchants")
            .select("*")
            .eq("user_id", user["id"])
            .execute()
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail="Internal server error")
    if not response.data:
        raise HTTPException(status_code=404, detail="Merchant not found")
    return _row_to_detail(response.data[0], is_owner=True)


@router.get("", response_model=list[MerchantCard])
async def list_merchants(
    lat: float,
    lng: float,
    radius: int = 5000,
    category: str | None = None,
    q: str | None = None,
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    user: dict = Depends(get_current_user),
):
    supabase = get_user_supabase(user["token"])
    try:
        # TODO Sprint 3: add ST_DWithin via RPC or PostgREST spatial filter.
        query = (
            supabase.table("merchants")
            .select("*")
            .eq("is_active", True)
        )
        if category:
            query = query.eq("category", category)
        if q:
            query = query.text_search("search_vector", q)
        response = query.limit(limit).offset(offset).execute()
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail="Internal server error")

    return [
        MerchantCard.model_validate({**row, "lat": 0.0, "lng": 0.0, "distance_meters": None})
        for row in response.data
    ]


@router.post("", response_model=MerchantDetail, status_code=status.HTTP_201_CREATED)
async def create_merchant(
    data: MerchantCreate, user: dict = Depends(get_current_user)
):
    supabase = get_user_supabase(user["token"])
    try:
        location_wkt = geo.point_from_latlng(data.lat, data.lng)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    payload = data.model_dump()
    # Replace lat/lng with PostGIS-compatible WKT for the location column
    payload.pop("lat")
    payload.pop("lng")
    payload["location"] = location_wkt
    payload["user_id"] = user["id"]

    try:
        import logging
        logging.getLogger(__name__).error("CREATE MERCHANT: user_id=%s, name=%s", user["id"], data.name)
        response = supabase.table("merchants").insert(payload).execute()
    except Exception as e:
        import logging
        logging.getLogger(__name__).error("Merchant insert failed for user_id=%s: %s", user["id"], str(e))
        msg = str(e).lower()
        if "duplicate" in msg or "unique" in msg:
            raise HTTPException(
                status_code=409, detail="User already has a merchant profile"
            )
        raise HTTPException(status_code=500, detail="Internal server error")

    if not response.data:
        raise HTTPException(status_code=400, detail="Failed to create merchant")
    return _row_to_detail(response.data[0], is_owner=True)


@router.get("/{merchant_id}", response_model=MerchantDetail)
async def get_merchant(
    merchant_id: str, user: dict = Depends(get_current_user)
):
    supabase = get_user_supabase(user["token"])
    try:
        response = (
            supabase.table("merchants")
            .select("*")
            .eq("id", merchant_id)
            .execute()
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail="Internal server error")
    if not response.data:
        raise HTTPException(status_code=404, detail="Merchant not found")
    row = response.data[0]
    is_owner = row.get("user_id") == user["id"]
    # Check if current user follows this merchant
    is_following = False
    if not is_owner:
        try:
            follow_resp = (
                supabase.table("follows")
                .select("merchant_id", count="exact")
                .eq("follower_id", user["id"])
                .eq("merchant_id", merchant_id)
                .execute()
            )
            is_following = (follow_resp.count or 0) > 0
        except Exception:
            pass
    return _row_to_detail(row, is_owner=is_owner, is_following=is_following)


@router.patch("/{merchant_id}", response_model=MerchantDetail)
async def update_merchant(
    merchant_id: str,
    data: MerchantUpdate,
    user: dict = Depends(get_current_user),
):
    supabase = get_user_supabase(user["token"])
    check_merchant_owner(supabase, merchant_id, user["id"])

    update_data = data.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    # Convert lat/lng to PostGIS WKT if location is being updated
    lat = update_data.pop("lat", None)
    lng = update_data.pop("lng", None)
    if (lat is None) != (lng is None):
        raise HTTPException(
            status_code=422, detail="Both lat and lng must be provided together"
        )
    if lat is not None and lng is not None:
        try:
            update_data["location"] = geo.point_from_latlng(lat, lng)
        except ValueError as e:
            raise HTTPException(status_code=422, detail=str(e))

    try:
        response = (
            supabase.table("merchants")
            .update(update_data)
            .eq("id", merchant_id)
            .execute()
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail="Internal server error")
    if not response.data:
        raise HTTPException(status_code=404, detail="Merchant not found")
    return _row_to_detail(response.data[0], is_owner=True)


@router.delete("/{merchant_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_merchant(
    merchant_id: str, user: dict = Depends(get_current_user)
):
    supabase = get_user_supabase(user["token"])
    check_merchant_owner(supabase, merchant_id, user["id"])

    try:
        supabase.table("merchants").update({"is_active": False}).eq(
            "id", merchant_id
        ).execute()
    except Exception as e:
        raise HTTPException(status_code=500, detail="Internal server error")

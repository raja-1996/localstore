"""Search route — combined pg_trgm + tsvector search across merchants and services."""
import logging

from fastapi import APIRouter, Depends, HTTPException, Query

from app.core.auth import get_current_user
from app.core.supabase import get_user_supabase
from app.schemas.merchants import MerchantCategory
from app.schemas.search import (
    SearchMerchantItem,
    SearchResponse,
    SearchServiceItem,
    ServiceMerchantBrief,
)
from app.services import search_service

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("", response_model=SearchResponse)
async def search(
    q: str = Query(..., min_length=1, max_length=200),
    lat: float | None = Query(default=None, ge=-90, le=90),
    lng: float | None = Query(default=None, ge=-180, le=180),
    radius: int | None = Query(default=None, ge=1, le=50000),
    # Issue 9 fix: type as MerchantCategory enum so FastAPI returns 422 for invalid values
    category: MerchantCategory | None = Query(default=None),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    user: dict = Depends(get_current_user),
):
    """Search merchants and services by text query.

    - q is required (422 if empty)
    - lat/lng optional; if provided, results include distance_meters
    - radius optional; requires lat/lng to take effect
    - category filters merchants by MerchantCategory enum value (422 for invalid values)
    """
    supabase = get_user_supabase(user["token"])

    # Validate lat/lng pair
    if (lat is None) != (lng is None):
        raise HTTPException(
            status_code=422, detail="Both lat and lng must be provided together"
        )

    try:
        results = search_service.search(
            supabase=supabase,
            query=q,
            lat=lat,
            lng=lng,
            radius_m=radius,
            category=category.value if category is not None else None,
            limit=limit,
            offset=offset,
        )
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception:
        # Issue 7 fix: log the original exception before raising 500
        logger.exception("RPC call failed: search_merchants / search_services")
        raise HTTPException(status_code=500, detail="Internal server error")

    # Convert merchant rows to SearchMerchantItem
    merchants = [
        SearchMerchantItem(
            id=str(row["id"]),
            name=row["name"],
            category=row["category"],
            lat=row["lat"],
            lng=row["lng"],
            avg_rating=row.get("avg_rating", 0),
            review_count=row.get("review_count", 0),
            follower_count=row.get("follower_count", 0),
            is_verified=row.get("is_verified", False),
            distance_meters=row.get("distance_meters"),
            neighborhood=row.get("neighborhood"),
            rank_score=row.get("rank_score"),
        )
        for row in results["merchants"]
    ]

    # Convert service rows to SearchServiceItem
    services = [
        SearchServiceItem(
            id=str(row["id"]),
            merchant=ServiceMerchantBrief(
                id=str(row["merchant_id"]),
                name=row["merchant_name"],
            ),
            name=row["name"],
            description=row.get("description"),
            price=row.get("price"),
            price_unit=row.get("price_unit"),
            image_url=row.get("image_url"),
            distance_meters=row.get("distance_meters"),
            rank_score=row.get("rank_score"),
        )
        for row in results["services"]
    ]

    return SearchResponse(merchants=merchants, services=services)

"""Feed routes — nearby merchants sorted by distance, cursor-paginated."""
# TODO Sprint 4: add GET /following for merchant follow feed
import logging
import math

from fastapi import APIRouter, Depends, HTTPException, Query

from app.core.auth import get_current_user
from app.core.supabase import get_user_supabase
from app.schemas.feed import NearbyFeedItem, NearbyFeedResponse
from app.schemas.merchants import MerchantCategory

router = APIRouter()
logger = logging.getLogger(__name__)


def _parse_cursor(cursor: str | None) -> tuple[float | None, str | None]:
    """Parse a distance_id cursor string into (distance, id) tuple.

    Cursor format: "{distance_meters}_{uuid}"
    Returns (None, None) if cursor is None.
    For non-None invalid cursors, returns (None, None) as well — forgiving to
    prevent mobile clients getting stuck in infinite-loop pagination on a bad cursor.
    """
    if cursor is None:
        return None, None
    parts = cursor.split("_", 1)
    if len(parts) != 2:
        # Non-None but structurally invalid; reset to page 1 (forgiving pagination)
        return None, None
    try:
        distance = float(parts[0])
        # Issue 10 fix: reject non-finite or negative distances to prevent crafted cursors
        # from sending unexpected values to the RPC function.
        if not math.isfinite(distance) or distance < 0:
            return None, None
        item_id = parts[1]
        return distance, item_id
    except (ValueError, IndexError):
        return None, None


def _make_cursor(distance: float, item_id: str) -> str:
    """Build a cursor string from distance and item ID."""
    return f"{distance}_{item_id}"


@router.get("/nearby", response_model=NearbyFeedResponse)
async def feed_nearby(
    lat: float = Query(..., ge=-90, le=90),
    lng: float = Query(..., ge=-180, le=180),
    radius: int = Query(default=5000, ge=1, le=50000),
    # Issue 9 fix: type as MerchantCategory enum so FastAPI returns 422 for invalid values
    category: MerchantCategory | None = Query(default=None),
    limit: int = Query(default=20, ge=1, le=100),
    before: str | None = Query(default=None),
    user: dict = Depends(get_current_user),
):
    """Get nearby merchants sorted by distance with cursor pagination.

    - lat/lng are required (400 if missing via Query(...))
    - radius in meters, default 5000, max 50000
    - category filters by MerchantCategory enum value (422 for invalid values)
    - cursor format: "{distance}_{id}" from previous response's next_cursor
    """
    # Issue 8: NearbyFeedResponse is a concrete type rather than PaginatedResponse[NearbyFeedItem]
    # because NearbyFeedItem carries type: Literal["merchant"] as a discriminator field.
    # When MVP 3 adds post items with a different discriminator, the union will be expressed
    # here explicitly — PaginatedResponse[T] does not support that discriminated union pattern.
    supabase = get_user_supabase(user["token"])

    # Parse cursor
    cursor_distance, cursor_id = _parse_cursor(before)

    try:
        params = {
            "p_lat": lat,
            "p_lng": lng,
            "p_radius_m": radius,
            "p_category": category.value if category is not None else None,
            "p_limit": limit,
            "p_cursor_distance": cursor_distance,
            "p_cursor_id": cursor_id,
        }
        response = supabase.rpc("nearby_merchants", params).execute()
    except Exception:
        # Issue 7 fix: log the original exception before raising 500
        logger.exception("RPC call failed: nearby_merchants")
        raise HTTPException(status_code=500, detail="Internal server error")

    rows = response.data or []

    # RPC returns limit+1 rows; if we got more than limit, there are more results
    has_more = len(rows) > limit
    if has_more:
        rows = rows[:limit]  # trim to requested limit

    # Convert to NearbyFeedItem
    items = []
    for row in rows:
        items.append(NearbyFeedItem(
            type="merchant",
            id=str(row["id"]),
            name=row["name"],
            category=row["category"],
            lat=row["lat"],
            lng=row["lng"],
            avg_rating=row.get("avg_rating", 0),
            review_count=row.get("review_count", 0),
            follower_count=row.get("follower_count", 0),
            is_verified=row.get("is_verified", False),
            distance_meters=row["distance_meters"],
            description=row.get("description"),
            neighborhood=row.get("neighborhood"),
            tags=row.get("tags"),
        ))

    # Build next_cursor from the last item
    next_cursor = None
    if has_more and items:
        last = items[-1]
        next_cursor = _make_cursor(last.distance_meters, last.id)

    return NearbyFeedResponse(
        data=items,
        has_more=has_more,
        next_cursor=next_cursor,
    )

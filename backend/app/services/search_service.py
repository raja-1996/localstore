"""Combined pg_trgm + tsvector search query builder.

Calls Supabase RPC functions search_merchants() and search_services().
No FastAPI imports — raises ValueError for invalid input.
"""
# Issue 3 fix: import math at module top level (not inside function body)
import math

# Issue 4 fix: import point_from_latlng from geo to reuse validation logic (DRY)
from app.services.geo import point_from_latlng


def search(
    supabase,
    query: str,
    lat: float | None = None,
    lng: float | None = None,
    radius_m: int | None = None,
    category: str | None = None,
    limit: int = 20,
    offset: int = 0,
) -> dict:
    """Execute combined merchant + service search.

    Args:
        supabase: Supabase client (user-scoped, RLS-enforced).
        query: Search text. Must be non-empty.
        lat: User latitude (optional, enables distance sort).
        lng: User longitude (optional, enables distance sort).
        radius_m: Search radius in meters (optional, requires lat/lng).
        category: Filter by merchant category string (optional).
        limit: Max results per type (default 20).
        offset: Offset for pagination (default 0).

    Returns:
        dict with keys: merchants (list[dict]), services (list[dict])

    Raises:
        ValueError: if query is empty or lat/lng are invalid.
    """
    # Issue 11: function name 'search' is intentional per plan.md; CLAUDE.md updated accordingly
    if not query or not query.strip():
        raise ValueError("Search query must not be empty")

    query = query.strip()

    # Issue 4 fix: use point_from_latlng() from geo.py for coordinate validation
    # instead of duplicating the bounds-check logic here.
    if lat is not None or lng is not None:
        if lat is None or lng is None:
            raise ValueError("Both lat and lng must be provided together")
        point_from_latlng(lat, lng)  # raises ValueError for invalid coordinates

    # Issue 5 fix: one shared params dict for both RPC calls (they are identical)
    params = {
        "p_query": query,
        "p_lat": lat,
        "p_lng": lng,
        "p_radius_m": radius_m,
        "p_category": category,
        "p_limit": limit,
        "p_offset": offset,
    }

    merchant_response = supabase.rpc("search_merchants", params).execute()
    merchants = merchant_response.data or []

    service_response = supabase.rpc("search_services", params).execute()
    services = service_response.data or []

    return {"merchants": merchants, "services": services}

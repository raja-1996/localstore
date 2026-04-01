import math


# Returns a WKT point string for use in PostGIS queries (external API).
def point_from_latlng(lat: float, lng: float) -> str:
    if not (math.isfinite(lat) and math.isfinite(lng)):
        raise ValueError(f"lat and lng must be finite numbers, got lat={lat}, lng={lng}")
    if not (-90 <= lat <= 90):
        raise ValueError(f"lat must be in [-90, 90], got {lat}")
    if not (-180 <= lng <= 180):
        raise ValueError(f"lng must be in [-180, 180], got {lng}")
    return f"POINT({lng} {lat})"


def nearby_query(lat: float, lng: float, radius_m: int) -> str:
    if not (math.isfinite(lat) and math.isfinite(lng)):
        raise ValueError(f"lat and lng must be finite numbers, got lat={lat}, lng={lng}")
    if radius_m <= 0:
        raise ValueError(f"radius_m must be > 0, got {radius_m}")
    point_from_latlng(lat, lng)  # validates bounds; raises ValueError if out of range
    return (
        f"ST_DWithin(location::geography, "
        f"ST_SetSRID(ST_MakePoint({lng}, {lat}), 4326)::geography, {radius_m})"
    )

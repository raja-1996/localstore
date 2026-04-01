-- 009_feed_search_rpc.sql
-- RPC functions for the /feed/nearby and /search endpoints.
-- These wrap PostGIS spatial queries that can't be expressed via PostgREST filters.

-- nearby_merchants: returns active merchants within a radius, sorted by distance.
-- Cursor pagination uses (distance, id) composite key for stable ordering.
CREATE OR REPLACE FUNCTION nearby_merchants(
  p_lat       DOUBLE PRECISION,
  p_lng       DOUBLE PRECISION,
  p_radius_m  INT DEFAULT 5000,
  p_category  TEXT DEFAULT NULL,
  p_limit     INT DEFAULT 20,
  p_cursor_distance DOUBLE PRECISION DEFAULT NULL,
  p_cursor_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id                    UUID,
  user_id               UUID,
  name                  TEXT,
  description           TEXT,
  category              TEXT,
  tags                  TEXT[],
  address_text          TEXT,
  neighborhood          TEXT,
  service_radius_meters INT,
  avg_rating            NUMERIC(3,2),
  review_count          INT,
  follower_count        INT,
  response_time_minutes INT,
  is_verified           BOOLEAN,
  is_active             BOOLEAN,
  video_intro_url       TEXT,
  created_at            TIMESTAMPTZ,
  updated_at            TIMESTAMPTZ,
  lat                   DOUBLE PRECISION,
  lng                   DOUBLE PRECISION,
  distance_meters       DOUBLE PRECISION
)
LANGUAGE sql STABLE
AS $$
  -- Issue 1 fix: compute distance_meters once in a CTE to avoid 3x ST_Distance calls
  -- Issue 6 fix: phone and whatsapp removed — feed is public-to-all-authenticated endpoint
  WITH computed AS (
    SELECT
      m.id, m.user_id, m.name, m.description, m.category, m.tags,
      m.address_text, m.neighborhood, m.service_radius_meters,
      m.avg_rating, m.review_count, m.follower_count,
      m.response_time_minutes, m.is_verified, m.is_active, m.video_intro_url,
      m.created_at, m.updated_at,
      ST_Y(m.location::geometry) AS lat,
      ST_X(m.location::geometry) AS lng,
      ST_Distance(
        m.location::geography,
        ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography
      ) AS distance_meters
    FROM merchants m
    WHERE m.is_active = true
      AND ST_DWithin(
        m.location::geography,
        ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography,
        p_radius_m
      )
      AND (p_category IS NULL OR m.category = p_category)
  )
  SELECT *
  FROM computed
  WHERE (
    p_cursor_distance IS NULL
    OR distance_meters > p_cursor_distance
    OR (distance_meters = p_cursor_distance AND id > p_cursor_id)
  )
  ORDER BY distance_meters ASC, id ASC
  LIMIT p_limit + 1;
$$;

-- search_merchants: combined pg_trgm + tsvector search on merchants table.
-- Returns merchants matching query by name similarity OR full-text search_vector.
CREATE OR REPLACE FUNCTION search_merchants(
  p_query     TEXT,
  p_lat       DOUBLE PRECISION DEFAULT NULL,
  p_lng       DOUBLE PRECISION DEFAULT NULL,
  p_radius_m  INT DEFAULT NULL,
  p_category  TEXT DEFAULT NULL,
  p_limit     INT DEFAULT 20,
  p_offset    INT DEFAULT 0
)
RETURNS TABLE (
  id                    UUID,
  user_id               UUID,
  name                  TEXT,
  description           TEXT,
  category              TEXT,
  tags                  TEXT[],
  address_text          TEXT,
  neighborhood          TEXT,
  service_radius_meters INT,
  avg_rating            NUMERIC(3,2),
  review_count          INT,
  follower_count        INT,
  response_time_minutes INT,
  is_verified           BOOLEAN,
  is_active             BOOLEAN,
  video_intro_url       TEXT,
  created_at            TIMESTAMPTZ,
  updated_at            TIMESTAMPTZ,
  lat                   DOUBLE PRECISION,
  lng                   DOUBLE PRECISION,
  distance_meters       DOUBLE PRECISION,
  rank_score            DOUBLE PRECISION
)
LANGUAGE sql STABLE
AS $$
  -- Issue 6 fix: phone and whatsapp removed — search is public-to-all-authenticated endpoint
  SELECT
    m.id, m.user_id, m.name, m.description, m.category, m.tags,
    m.address_text, m.neighborhood, m.service_radius_meters,
    m.avg_rating, m.review_count, m.follower_count,
    m.response_time_minutes, m.is_verified, m.is_active, m.video_intro_url,
    m.created_at, m.updated_at,
    ST_Y(m.location::geometry) AS lat,
    ST_X(m.location::geometry) AS lng,
    CASE
      WHEN p_lat IS NOT NULL AND p_lng IS NOT NULL THEN
        ST_Distance(
          m.location::geography,
          ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography
        )
      ELSE NULL
    END AS distance_meters,
    GREATEST(
      similarity(m.name, p_query),
      ts_rank(m.search_vector, plainto_tsquery('simple', p_query))
    ) AS rank_score
  FROM merchants m
  WHERE m.is_active = true
    AND (
      similarity(m.name, p_query) > 0.1
      OR m.search_vector @@ plainto_tsquery('simple', p_query)
    )
    AND (p_category IS NULL OR m.category = p_category)
    AND (
      p_lat IS NULL OR p_lng IS NULL OR p_radius_m IS NULL
      OR ST_DWithin(
        m.location::geography,
        ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography,
        p_radius_m
      )
    )
  ORDER BY rank_score DESC, m.id ASC
  LIMIT p_limit
  OFFSET p_offset;
$$;

-- search_services: find services by name/description matching.
-- Joins with merchant to include merchant_name and location.
CREATE OR REPLACE FUNCTION search_services(
  p_query     TEXT,
  p_lat       DOUBLE PRECISION DEFAULT NULL,
  p_lng       DOUBLE PRECISION DEFAULT NULL,
  p_radius_m  INT DEFAULT NULL,
  p_category  TEXT DEFAULT NULL,
  p_limit     INT DEFAULT 20,
  p_offset    INT DEFAULT 0
)
RETURNS TABLE (
  id            UUID,
  merchant_id   UUID,
  merchant_name TEXT,
  name          TEXT,
  description   TEXT,
  price         NUMERIC(10,2),
  price_unit    TEXT,
  image_url     TEXT,
  is_available  BOOLEAN,
  distance_meters DOUBLE PRECISION,
  rank_score    DOUBLE PRECISION
)
LANGUAGE sql STABLE
AS $$
  SELECT
    s.id, s.merchant_id, m.name AS merchant_name,
    s.name, s.description, s.price, s.price_unit, s.image_url, s.is_available,
    CASE
      WHEN p_lat IS NOT NULL AND p_lng IS NOT NULL THEN
        ST_Distance(
          m.location::geography,
          ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography
        )
      ELSE NULL
    END AS distance_meters,
    similarity(s.name, p_query) AS rank_score
  FROM services s
  JOIN merchants m ON m.id = s.merchant_id
  WHERE m.is_active = true
    AND s.is_available = true
    AND (
      -- Issue 13 fix: replaced ILIKE '%' || p_query || '%' (SQL injection risk via string concat)
      -- with pg_trgm similarity operator (%) which is fully parameterized.
      similarity(s.name, p_query) > 0.1
      OR s.name % p_query
    )
    AND (p_category IS NULL OR m.category = p_category)
    AND (
      p_lat IS NULL OR p_lng IS NULL OR p_radius_m IS NULL
      OR ST_DWithin(
        m.location::geography,
        ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography,
        p_radius_m
      )
    )
  ORDER BY rank_score DESC, s.id ASC
  LIMIT p_limit
  OFFSET p_offset;
$$;

-- Issue 12 fix: grant EXECUTE to authenticated role so PostgREST can call these functions.
-- Without explicit grants, Supabase may block the calls depending on project settings.
GRANT EXECUTE ON FUNCTION nearby_merchants(
  DOUBLE PRECISION, DOUBLE PRECISION, INT, TEXT, INT, DOUBLE PRECISION, UUID
) TO authenticated;

GRANT EXECUTE ON FUNCTION search_merchants(
  TEXT, DOUBLE PRECISION, DOUBLE PRECISION, INT, TEXT, INT, INT
) TO authenticated;

GRANT EXECUTE ON FUNCTION search_services(
  TEXT, DOUBLE PRECISION, DOUBLE PRECISION, INT, TEXT, INT, INT
) TO authenticated;

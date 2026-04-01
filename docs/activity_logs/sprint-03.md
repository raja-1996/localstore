## [2026-03-28] — Sprint 3: Feed + Search Backend

- Created `supabase/migrations/009_feed_search_rpc.sql`: 3 PostgreSQL RPC functions (`nearby_merchants` with CTE for single ST_Distance computation + composite cursor pagination; `search_merchants` pg_trgm+tsvector; `search_services` pg_trgm+ILIKE-safe); `GRANT EXECUTE TO authenticated` for all 3
- Created `backend/app/schemas/feed.py`: `NearbyFeedItem` (type discriminator `"merchant"`, required `distance_meters`), `NearbyFeedResponse` (concrete, not generic — annotated why)
- Created `backend/app/schemas/search.py`: `SearchMerchantItem`, `SearchServiceItem`, `ServiceMerchantBrief`, `SearchResponse`
- Created `backend/app/services/search_service.py`: `search()` delegating to 2 Supabase RPC calls; coordinate validation via `geo.point_from_latlng()`; no FastAPI imports
- Created `backend/app/api/v1/feed.py`: `GET /feed/nearby`; `_parse_cursor`/`_make_cursor` helpers; limit+1 fetch pattern; `MerchantCategory | None` enum for category param; logging before 500
- Created `backend/app/api/v1/search.py`: `GET /search`; lat/lng pair validation → 422; `MerchantCategory | None` enum; delegates to search_service
- Updated `backend/app/api/v1/router.py`: registered feed (`/feed`) and search (`/search`) routers
- Created unit tests: `test_search_service.py` (10), `test_feed.py` (8), `test_search.py` (8) — all 26 pass; 150 unit tests total
- Created integration tests: `test_feed_integration.py` (4), `test_search_integration.py` (3) — all 7 pass against real Supabase with PostGIS + pg_trgm
- Gotcha: Supabase PostgREST does NOT support `ST_DWithin` as a filter — must use `.rpc()` to call a PostgreSQL function
- Gotcha: `ILIKE '%' || p_query || '%'` in SQL functions is a SQL injection vector — use pg_trgm `%` operator instead
- Gotcha: New PostgreSQL RPC functions need explicit `GRANT EXECUTE ON FUNCTION ... TO authenticated` or PostgREST may block them
- Gotcha: Compute `ST_Distance` once via CTE before filtering on it — computing it 3× in WHERE/ORDER BY triples geo computation cost

## [2026-03-28] — Sprint 2: Merchants + Services + Portfolio Backend

- Created `backend/app/schemas/merchants.py`: MerchantCreate, MerchantUpdate, MerchantDetail, MerchantCard, mask_phone(); phone/whatsapp auto-masked via model_validator; is_owner flag bypasses masking
- Created `backend/app/schemas/services.py`: ServiceCreate, ServiceUpdate, ServiceResponse; price uses Decimal (NUMERIC(10,2))
- Created `backend/app/schemas/portfolio.py`: PortfolioImageCreate, PortfolioImageResponse, ReorderRequest
- Created `backend/app/services/__init__.py` + `backend/app/services/geo.py`: point_from_latlng(), nearby_query() with ST_SetSRID + ::geography cast; nan/inf guards
- Created `backend/app/api/v1/merchants.py`: GET/POST /merchants, GET/PATCH/DELETE /merchants/{id}, GET /merchants/me; /me registered before /{id}; pagination (limit/offset)
- Created `backend/app/api/v1/services.py`: CRUD /merchants/{mid}/services
- Created `backend/app/api/v1/portfolio.py`: CRUD /merchants/{mid}/portfolio with max-10 enforcement; reorder via sequential updates
- Created `backend/app/api/v1/deps.py`: shared check_merchant_owner() helper (reused by merchants, services, portfolio)
- Updated `backend/app/api/v1/router.py`: registered merchants, services, portfolio routers
- Created `backend/tests/test_merchants.py` (13 tests), `test_services.py` (8), `test_portfolio.py` (5), `test_geo.py` (10)
- Created `backend/tests/integration/test_merchants_integration.py` (12 integration tests)
- Created `supabase/seed.sql`: 11 merchants in Koramangala (Food×3, Beauty×4, Tailoring×3, 1 inactive); 6 services; 2 portfolio images; idempotent via BEGIN/DELETE/COMMIT
- Backend: 123 unit tests pass
- Gotcha: /merchants/me MUST register before /{id} in router — FastAPI matches in order
- Gotcha: PostGIS GEOGRAPHY needs ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography cast (not bare ST_MakePoint)
- Gotcha: MerchantDetail.phone auto-masked by model_validator; use is_owner=True to bypass for /me endpoint
- Gotcha: Supabase Python SDK returns location as hex EWKB — lat/lng set to 0.0 placeholder; parse with shapely or PostGIS ST_AsText in Sprint 3

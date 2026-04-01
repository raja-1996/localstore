# tests/
Unit test suite for all API endpoints using mocked Supabase — no live instance required.

- `conftest.py` — shared fixtures and mock setup for all unit tests
  - exports: `MOCK_USER`, `AUTH_HEADERS`, `make_mock_session`, `client` (pytest fixture)
  - deps: `app.main`, `app.core.auth.get_current_user`
  - side-effects: sets `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_DEFAULT_KEY`, `SUPABASE_SECRET_DEFAULT_KEY` env vars at import time (before app loads)
  - env: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_DEFAULT_KEY`, `SUPABASE_SECRET_DEFAULT_KEY`
  - pattern: FastAPI dependency override — `get_current_user` replaced with lambda returning `MOCK_USER`
  - gotcha: env vars must be set via `os.environ.setdefault` BEFORE any app import; order matters — env setup is at module top-level, not inside a fixture
  - types: `MOCK_USER = {id, email, token}`, `AUTH_HEADERS = {Authorization: "Bearer test-token"}`

- `test_auth.py` — unit tests for `/api/v1/auth` endpoints: `/otp/send`, `/otp/verify`, `/refresh`, `/logout`, signup, delete account
  - deps: `tests.conftest`, `app.api.v1.auth.get_supabase`, `app.core.supabase.get_user_supabase`
  - side-effects: patches `app.api.v1.auth.get_supabase` and `app.core.supabase.get_user_supabase` per test
  - pattern: `_mock_supabase_with_session()` helper builds a MagicMock matching the Supabase auth response shape
  - gotcha: logout swallows exceptions and always returns 204; test explicitly verifies this behavior

- `test_auth_schemas.py` — unit tests for auth Pydantic models
  - tests: `OTPRequest` (E.164 phone validation), `OTPVerifyRequest` (phone + token), `RefreshRequest`, `AuthResponse`

- `test_users.py` — unit tests for `/api/v1/users` endpoints (replaces test_profile.py)
  - tests: `GET /users/me`, `PATCH /users/me`, `PUT /me/push-token`, following list

- `test_push_token.py` — unit tests for Expo push token storage (Sprint 9)
  - tests: `PUT /users/me/push-token` request validation, token min_length=1 constraint

- `test_health.py` — single test for `GET /health` returning `{"status": "ok"}`
  - deps: `app.main`
  - gotcha: does not use the shared `client` fixture — creates its own `TestClient(app)` directly (no auth override needed)

- `test_storage.py` — unit tests for `/api/v1/storage` endpoints (upload, download, delete)
  - deps: `tests.conftest`, `app.api.v1.storage.get_user_supabase`
  - side-effects: patches `app.api.v1.storage.get_user_supabase` per test
  - pattern: `_make_mock_user_sb()` helper sets up mock `storage.from_.create_signed_url` chain
  - gotcha: files without extension get `.bin` suffix — test_upload_no_file_extension verifies this edge case

- `test_push.py` — unit tests for push service functions (Sprint 11)
  - tests: `send_push`, `send_bulk_push` (mocked httpx), `get_recipient_push_token`, `get_sender_name`, `get_follower_push_tokens` (mocked Supabase client); 15 test cases
  - deps: `app.services.push_service`, mocked `httpx`, mocked `supabase`

- `test_push_followers.py` — unit tests for post creation triggering follower push (Sprint 11)
  - tests: `create_post` with BackgroundTasks; mocks `push_tasks.send_post_push`; 3 test cases
  - deps: `app.api.v1.posts`, mocked `push_tasks`

- `test_common_schemas.py` — unit tests for shared pagination and response types
  - deps: `app.schemas.common`, `pydantic`
  - tests: `CursorParams`, `PaginatedResponse` validation and serialization

- `test_merchants.py` — unit tests for `/api/v1/merchants` endpoints (13 tests)
  - deps: `tests.conftest`, `app.api.v1.merchants`
  - tests: list merchants, create merchant, get by id, update, delete, get /me; phone masking on detail; owner bypass
  - pattern: patches Supabase client per test; verifies masked vs unmasked phone in response

- `test_services.py` — unit tests for `/api/v1/merchants/{mid}/services` endpoints (8 tests)
  - deps: `tests.conftest`, `app.api.v1.services`
  - tests: list services, create, get by id, update, delete; price Decimal serialization

- `test_portfolio.py` — unit tests for `/api/v1/merchants/{mid}/portfolio` endpoints (5 tests)
  - deps: `tests.conftest`, `app.api.v1.portfolio`
  - tests: list images, add image, delete image, max-10 enforcement, reorder

- `test_geo.py` — unit tests for `app.services.geo` module (10 tests)
  - deps: `app.services.geo`
  - tests: point_from_latlng(), nearby_query(); nan/inf guard, zero coordinates, valid lat/lng ranges
  - pattern: pure function tests — no HTTP or Supabase mocks needed

- `test_search_service.py` — unit tests for `app.services.search_service.search()` (10 tests)
  - tests: combined merchant + service search; pg_trgm + tsvector via RPC; category/rating/price filters

- `test_feed.py` — unit tests for `/api/v1/feed` routes (8 tests)
  - tests: `/feed/nearby` endpoint; PostGIS cursor pagination; response structure validation

- `test_search.py` — unit tests for `/api/v1/search` routes (8 tests)
  - tests: `/search` endpoint; combined merchant + service results; query parameter validation

- `test_chat.py` — unit tests for `/api/v1/chat` endpoints (Sprint 9)
  - tests: GET/POST chats (thread CRUD), GET/POST messages (cursor-paginated), PATCH read status, user-scoped Supabase client

- `test_razorpay.py` — unit tests for `app.core.razorpay` module (Sprint 12)
  - tests: `verify_webhook_signature` (valid/invalid/empty sig/empty secret/tampered/bytes secret), `RazorpayClient` (create_order, fetch_payment, refund partial/full, API error, context manager, custom currency), migration file existence
  - deps: `app.core.razorpay`, mocked `httpx` via `patch.object`
  - pattern: `_compute_sig` helper for HMAC test data; `_make_mock_response`/`_make_error_response` for httpx mocks

- `__init__.py` — empty; marks directory as Python package for pytest import resolution

## Sub-folders
- `integration/` — real Supabase integration tests; auto-skipped if Supabase is unreachable
  - `test_auth_integration.py` — `/otp/send`, `/otp/verify` against real Twilio/Supabase
  - `test_users_integration.py` — `/users/me` endpoints (replaces test_profile_integration.py)
  - `test_merchants_integration.py` — `/merchants` CRUD + geo queries against real Supabase (12 tests); requires seed.sql applied

## How to Run
```
# Unit tests only (no Supabase needed)
pytest tests/ --ignore=tests/integration/

# All tests including integration
pytest tests/
```

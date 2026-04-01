# tests/integration/
Integration tests hitting a live Supabase instance — auto-skipped when unreachable.

- `conftest.py` — reachability check, env loading, session-scoped fixtures for real Supabase tests
  - exports: `skip_if_no_supabase` (pytest mark), `_SUPABASE_AVAILABLE` (bool), `TEST_PASSWORD` (str), `integration_client` (session fixture), `test_user` (session fixture)
  - deps: `app.main`, `app.core.config`, `app.core.supabase`
  - side-effects: loads `backend/.env.test` via `python-dotenv` if file exists; overwrites env vars; calls `importlib.reload(config_module)` and `get_supabase.cache_clear()` to force fresh config; creates + deletes a real Supabase user per session
  - env: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_DEFAULT_KEY`, `SUPABASE_SECRET_DEFAULT_KEY` (read from env or `.env.test`)
  - pattern: TCP reachability probe (`socket.create_connection` with 2s timeout) gates all tests before any HTTP call
  - gotcha: `integration_client` fixture reloads `app.core.config` and clears the `get_supabase` LRU cache — required because unit test conftest may have already initialized the module with fake credentials
  - gotcha: `test_user` fixture is `scope="session"` — one user is shared across all integration test classes; tests that call logout must use a fresh login to avoid invalidating the shared session
  - gotcha: teardown deletes the test user via `auth.admin.delete_user` — requires `SUPABASE_SECRET_DEFAULT_KEY` to be a service-role key (not anon key)
  - types: `test_user` yields `{email, password, access_token, refresh_token, user_id, auth_headers}`

- `test_auth_integration.py` — real auth flow tests: signup, login, wrong password, token refresh, logout, protected endpoint access
  - deps: `tests.integration.conftest`, `app.core.supabase.get_supabase`
  - side-effects: creates and deletes real Supabase users (signup tests clean up inline)
  - gotcha: `test_refresh_token` mutates the shared `test_user` dict in-place (updates `access_token`, `refresh_token`, `auth_headers`) so subsequent tests in the session use valid tokens

- `test_storage_integration.py` — real file upload/download/delete tests against Supabase `uploads` bucket
  - deps: `tests.integration.conftest`, `app.core.supabase.get_supabase`
  - side-effects: uploads and deletes real files in the Supabase `uploads` storage bucket
  - pattern: double skip guard — `skip_if_no_supabase` (module-level) + `skip_if_no_bucket` (class-level, checks bucket existence at collection time)
  - gotcha: requires an `uploads` bucket to exist in Supabase — create via Studio or SQL before running; tests are skipped (not failed) if bucket is absent
  - gotcha: `uploaded_file` fixture uploads a file and auto-deletes after the test, but `test_delete_requires_auth` uses `uploaded_file` — that fixture file may already be deleted by the test; cleanup is best-effort

- `test_todos_integration.py` — real todo CRUD tests with RLS verification and ordering assertions
  - deps: `tests.integration.conftest`
  - side-effects: inserts and deletes rows in the Supabase `todos` table
  - pattern: `created_todo` fixture (function-scoped) creates one todo per test; teardown also covered by session user deletion via `ON DELETE CASCADE`
  - gotcha: `test_list_todos_ordered_by_created_at_desc` uses `time.sleep(1)` between creates to ensure distinct timestamps — this is intentional
  - gotcha: `test_list_todos_only_own` explicitly verifies RLS is working — all returned todos must have `user_id` matching the authenticated user

- `test_feed_integration.py` — real `/feed/nearby` tests against live Supabase (4 tests)
  - tests: feed nearby cursor pagination; distance calculation; location-based merchant filtering

- `test_search_integration.py` — real `/search` tests against live Supabase (3 tests)
  - tests: combined merchant + service search; text search with pg_trgm; response structure validation

- `test_merchants_integration.py` — real `/merchants` CRUD tests; appended `TestMerchantEndpointsIntegration` class
  - tests: merchant creation, update, deletion; phone number masking in GET detail; services and portfolio endpoints
  - side-effects: creates and deletes real merchants in Supabase

- `test_rls_integration.py` — RLS policy verification tests (new in Sprint 4)
  - tests: verify auth guards and row-level security policies work correctly

- `test_merchant_creation_flow.py` — end-to-end merchant creation flow integration tests
  - tests: create merchant with profile, services, portfolio; verify RLS isolation; phone masking

- `test_users_me_extended.py` — extended `/users/me` endpoint integration tests
  - tests: get profile with extended fields, update profile, push token registration

- `test_chat_integration.py` — real chat integration tests against live Supabase (Sprint 9)
  - tests: create thread, list threads, send message, list messages (cursor-paginated), mark read, RLS isolation

- `test_push_integration.py` — real push integration tests against live Supabase (Sprint 11)
  - tests: send message triggers push notification to recipient; no push if recipient has no token; 2 test cases
  - deps: real Supabase, mocked `push_service.send_push` (to avoid hitting Expo API)

- `__init__.py` — empty; marks directory as Python package for pytest import resolution

## How to Run
```
# Start local Supabase first
supabase start

# Run integration tests
pytest tests/integration/ -v

# Skip integration tests entirely
pytest tests/ --ignore=tests/integration/
```

## Prerequisites
- `backend/.env.test` with `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_DEFAULT_KEY`, `SUPABASE_SECRET_DEFAULT_KEY`
- `SUPABASE_SECRET_DEFAULT_KEY` must be a service-role key (for admin user deletion)
- `uploads` storage bucket must exist for storage tests

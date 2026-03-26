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

- `test_auth.py` — unit tests for `/api/v1/auth` endpoints (signup, login, phone OTP, refresh, logout, delete account)
  - deps: `tests.conftest`, `app.api.v1.auth.get_supabase`, `app.core.supabase.get_user_supabase`
  - side-effects: patches `app.api.v1.auth.get_supabase` and `app.core.supabase.get_user_supabase` per test
  - pattern: `_mock_supabase_with_session()` helper builds a MagicMock matching the Supabase auth response shape
  - gotcha: logout swallows exceptions and always returns 204; test explicitly verifies this behavior

- `test_health.py` — single test for `GET /health` returning `{"status": "ok"}`
  - deps: `app.main`
  - gotcha: does not use the shared `client` fixture — creates its own `TestClient(app)` directly (no auth override needed)

- `test_storage.py` — unit tests for `/api/v1/storage` endpoints (upload, download, delete)
  - deps: `tests.conftest`, `app.api.v1.storage.get_user_supabase`
  - side-effects: patches `app.api.v1.storage.get_user_supabase` per test
  - pattern: `_make_mock_user_sb()` helper sets up mock `storage.from_.create_signed_url` chain
  - gotcha: files without extension get `.bin` suffix — test_upload_no_file_extension verifies this edge case

- `test_todos.py` — unit tests for `/api/v1/todos` CRUD endpoints (list, create, get, update, delete)
  - deps: `tests.conftest`, `app.api.v1.todos.get_user_supabase`
  - side-effects: patches `app.api.v1.todos.get_user_supabase` per test
  - types: `TODO_ROW = {id, user_id, title, description, image_path, is_completed, created_at, updated_at}`
  - gotcha: `PATCH /todos/{id}` with empty body `{}` returns 400 with `"No fields to update"` — not 422
  - gotcha: `GET /api/v1/todos` without Authorization header returns 422 (missing header), not 401

- `__init__.py` — empty; marks directory as Python package for pytest import resolution

## Sub-folders
- `integration/` — real Supabase integration tests; auto-skipped if Supabase is unreachable

## How to Run
```
# Unit tests only (no Supabase needed)
pytest tests/ --ignore=tests/integration/

# All tests including integration
pytest tests/
```

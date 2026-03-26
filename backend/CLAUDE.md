# backend
FastAPI REST API backed by Supabase providing auth, todo CRUD, and file storage for a React Native app.

## Stack
- Python: 3.12+
- FastAPI: HTTP framework, async routes, dependency injection
- Uvicorn: ASGI server (entrypoint in Dockerfile)
- Supabase SDK 2.28+: auth (email/password + phone OTP), Postgres (RLS-enforced), file storage
- Pydantic v2 + pydantic-settings: request/response validation, env-based config
- pytest + pytest-asyncio + httpx: test runner with async support

## Entry Points
- `app/main.py` — FastAPI app factory; mounts CORS middleware, `/health`, and `/api/v1` router
- `Dockerfile` — multi-stage build with `uv`; runs `uvicorn app.main:app` on port 8000

## Folder Map
- `app/` — main application package (routes, core infra, schemas)
- `app/api/v1/` — route handlers: `auth.py`, `todos.py`, `storage.py`; aggregated in `router.py`
- `app/core/` — shared infra: `config.py` (settings), `auth.py` (JWT dependency), `supabase.py` (client factories)
- `app/schemas/` — Pydantic request/response models: `auth.py`, `todos.py`, `storage.py`
- `tests/` — unit tests with mocked Supabase; `conftest.py` overrides `get_current_user`
- `tests/integration/` — real Supabase tests; auto-skip if instance unreachable; manages test-user lifecycle
- `backend.egg-info/` — generated package metadata (skip)

## Key Conventions
- All API endpoints are prefixed `/api/v1/{auth|todos|storage}`
- Auth: Bearer JWT passed in `Authorization` header; routes declare `Depends(get_current_user)`
- Two Supabase clients: `get_supabase()` = service-role singleton (admin, bypasses RLS); `get_user_supabase(token)` = per-request user-scoped client (enforces RLS)
- Use `get_user_supabase` for todos and storage; use `get_supabase` only for auth admin ops
- Schemas follow `*Request` (inbound) / `*Response` (outbound) naming
- Unit tests use `app.dependency_overrides[get_current_user]` + `unittest.mock.patch` on `get_supabase`; no live Supabase needed
- Integration tests load credentials from `backend/.env.test` (not committed); skip automatically if Supabase is unreachable

## Environment Variables
| Variable | Required | Purpose |
|----------|----------|---------|
| `SUPABASE_URL` | yes | Supabase project URL |
| `SUPABASE_PUBLISHABLE_DEFAULT_KEY` | yes | Anon/public key — used for user-scoped RLS client |
| `SUPABASE_SECRET_DEFAULT_KEY` | yes | Service-role key — used for admin operations |
| `DEBUG` | no | FastAPI debug mode (default: false) |
| `CORS_ORIGINS` | no | Allowed CORS origins (default: localhost:8081, localhost:19006) |

## Gotchas
- `settings` is instantiated at module import — missing required env vars raise `ValidationError` immediately on startup, not at request time
- `get_supabase` is cached via `lru_cache`; integration tests must call `get_supabase.cache_clear()` after reloading config
- `logout` swallows all exceptions by design — always returns 204
- `storage.py` hardcodes bucket name `"uploads"`; signed URLs expire in 3600 seconds
- `TodoUpdate` uses all-optional fields — a PATCH with an empty body returns 400, not silently no-ops
- Signed URL extraction in `storage.py` handles both object attribute (`signed_url`) and dict key (`signedURL`) — Supabase SDK return shape differs by version

# app/
Main FastAPI application package — wires middleware, routers, and infrastructure for the backend service.

- `__init__.py` — empty package marker; no exports
- `main.py` — app factory: creates `FastAPI` instance, attaches CORS middleware, `/health` endpoint, mounts `v1_router` at `/api/v1`
  - exports: `app` (FastAPI instance)
  - deps: `app.core.config` (settings), `app.api.v1.router` (v1_router), `fastapi.middleware.cors`
  - side-effects: registers global CORS middleware; exposes `/health` route returning `{"status": "ok"}`
  - gotcha: CORS `allow_origins` comes from `settings.cors_origins` (defaults to localhost:8081 and 19006 — change in `.env` for prod)

## Sub-packages

- `api/` — versioned route handlers; all routes live under `/api/v1/{auth|todos|storage}`
- `core/` — shared infrastructure: settings, Supabase client factories, JWT auth dependency
- `schemas/` — Pydantic request/response models; no business logic, no DB access

## Key Patterns
- Entry point for the ASGI server is `app` object in `main.py` (run via `uvicorn app.main:app`)
- All routes are prefixed `/api/v1`; health check at `/health` is outside the versioned prefix
- Auth dependency `get_current_user` (from `core/auth.py`) is injected via `Depends()` on protected routes
- Two Supabase client modes: `get_supabase()` (service-role singleton, admin ops) and `get_user_supabase(token)` (user-scoped, enforces RLS)
- `TodoUpdate` uses all-optional fields — call `model_dump(exclude_none=True)` before sending to Supabase
- Storage routes use a hardcoded bucket name `"uploads"` in `api/v1/storage.py`
- Signed URLs for storage expire after 3600 seconds (1 hour)

## Navigation
| Task | File to open |
|------|-------------|
| Add/change an endpoint | `api/v1/{auth,todos,storage}.py` |
| Register a new router | `api/v1/router.py` → `main.py` |
| Change env vars / config | `core/config.py` |
| Modify auth logic | `core/auth.py` |
| Switch Supabase client | `core/supabase.py` |
| Change request/response shape | `schemas/{auth,todos,storage}.py` |
| App startup / middleware | `main.py` |

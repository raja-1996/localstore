# app/
Main FastAPI application package for LocalStore — wires middleware, routers, services, and infrastructure.

- `__init__.py` — empty package marker
- `main.py` — app factory: creates `FastAPI` instance, CORS middleware, `/health` endpoint, mounts `v1_router` at `/api/v1`
  - exports: `app` (FastAPI instance)
  - deps: `app.core.config` (settings), `app.api.v1.router` (v1_router)
  - gotcha: CORS `allow_origins` from `settings.cors_origins` — production must list exact domains, never `*`

## Sub-packages

- `api/v1/` — versioned route handlers (~22 files); all routes live under `/api/v1/{domain}`
- `services/` — business logic layer (no HTTP imports): geo, search, payment, push, recommendation, voice. Route handlers call these; they are testable without HTTP.
- `background/` — FastAPI BackgroundTasks functions: push notification dispatch, voice upload cleanup
- `core/` — shared infrastructure: settings, Supabase client factories, JWT auth dependency, Razorpay client
- `schemas/` — Pydantic request/response models; one file per route + `common.py` for shared types

## Navigation
| Task | File to open |
|------|-------------|
| Add/change an endpoint | `api/v1/{domain}.py` |
| Register a new router | `api/v1/router.py` → `main.py` |
| Change env vars / config | `core/config.py` |
| Modify auth logic | `core/auth.py` |
| Switch Supabase client | `core/supabase.py` |
| Add Razorpay call | `core/razorpay.py` |
| Change request/response shape | `schemas/{domain}.py` |
| Add business logic | `services/{module}.py` |
| Add background task | `background/{module}.py` |
| App startup / middleware | `main.py` |

## Key Patterns
- Entry point: `uvicorn app.main:app`
- All routes prefixed `/api/v1`; health at `/health` (no prefix)
- Auth via `Depends(get_current_user)` on protected routes; `POST /payments/webhook` excluded (HMAC only)
- Two Supabase client modes: `get_supabase()` (service-role singleton) and `get_user_supabase(token)` (user-scoped, RLS)
- Thin route handlers → call `services/` for logic → return response
- Cursor pagination via `schemas/common.py`: `CursorParams` + `PaginatedResponse`
- `services.py` in `api/v1/` is the service-catalog route file; `services/` (folder) is business logic — distinct import paths

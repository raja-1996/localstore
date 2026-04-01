# backend
FastAPI REST API backed by Supabase for LocalStore — a hyperlocal services marketplace. Provides auth (phone OTP), merchant/service CRUD, geo feed, chat, orders/payments, recommendations, voice search, and file storage.

## Stack
- Python: 3.12+
- FastAPI: HTTP framework, async routes, dependency injection
- Uvicorn: ASGI server (entrypoint in Dockerfile)
- Supabase SDK 2.28+: auth (phone OTP + email), Postgres (RLS + PostGIS), file storage
- Pydantic v2 + pydantic-settings: request/response validation, env-based config
- httpx: async HTTP client for Razorpay and AI APIs
- exponent_server_sdk: Expo push notification dispatch
- hmac (stdlib): Razorpay webhook signature verification
- pytest + pytest-asyncio + httpx: test runner with async support

## Entry Points
- `app/main.py` — FastAPI app factory; mounts CORS middleware, `/health`, and `/api/v1` router
- `Dockerfile` — multi-stage build with `uv`; runs `uvicorn app.main:app` on port 8000

## Folder Map
- `app/` — main application package
- `app/api/v1/` — route handlers (~22 files): auth, users, merchants, services, portfolio, feed, search, follows, reviews, posts, likes, comments, chat, orders, payments, recommendations, referrals, leaderboard, voice, festivals, need_posts, insights, storage; aggregated in `router.py`
- `app/services/` — business logic layer (no HTTP imports): geo, search, payment, push, recommendation, voice
- `app/background/` — FastAPI BackgroundTasks functions: push dispatch, voice upload cleanup
- `app/core/` — shared infra: `config.py` (settings), `auth.py` (JWT dependency), `supabase.py` (client factories), `razorpay.py` (httpx wrapper)
- `app/schemas/` — Pydantic request/response models (1 file per route + `common.py` for pagination)
- `tests/` — unit tests with mocked Supabase; `conftest.py` overrides `get_current_user`
- `tests/integration/` — real Supabase tests (PostGIS geo queries, storage, auth lifecycle); auto-skip if unreachable

## Key Conventions
- All API endpoints prefixed `/api/v1/{domain}` — auth, merchants, services, feed, etc.
- Auth: Bearer JWT in `Authorization` header; routes declare `Depends(get_current_user)`
- Exception: `POST /payments/webhook` has NO JWT — validated by HMAC signature only
- Two Supabase clients: `get_supabase()` = service-role singleton; `get_user_supabase(token)` = user-scoped (RLS)
- Use `get_user_supabase` by default; `get_supabase` only for: auth admin, payment_events, merchant_insights, service-role storage
- Route handlers are thin: validate → call service function → return. Business logic lives in `app/services/`
- Schemas follow `*Create/*Update` (inbound) / `*Response/*Card/*Detail` (outbound) naming
- Cursor-based pagination: `CursorParams` and `PaginatedResponse` in `schemas/common.py`
- `OrderCreate` schema must NOT include `merchant_id` — always derived server-side from `service_id`
- Order status transitions enforced by `VALID_TRANSITIONS` dict in `orders.py`
- Phone/whatsapp masked in `GET /merchants/{id}` — full number only for self or active chat participant

## Environment Variables
| Variable | Required | Purpose |
|----------|----------|---------|
| `SUPABASE_URL` | yes | Supabase project URL |
| `SUPABASE_PUBLISHABLE_DEFAULT_KEY` | yes | Anon key — user-scoped RLS client |
| `SUPABASE_SECRET_DEFAULT_KEY` | yes | Service-role key — admin operations |
| `RAZORPAY_KEY_ID` | MVP 4+ | Razorpay API key ID |
| `RAZORPAY_KEY_SECRET` | MVP 4+ | Razorpay API key secret |
| `RAZORPAY_WEBHOOK_SECRET` | MVP 4+ | Webhook HMAC signature verification |
| `SARVAM_API_KEY` | MVP 6 | Sarvam.ai STT/TTS API key |
| `LLM_API_KEY` | MVP 6 | LLM provider API key |
| `LLM_PROVIDER` | no | `openai` (default) or `gemini` |
| `CORS_ORIGINS` | no | JSON array of allowed origins (default: localhost:8081) |
| `DEBUG` | no | FastAPI debug mode (default: false) |

## Gotchas
- `settings` instantiated at module import — missing required env vars raise `ValidationError` on startup
- `get_supabase` cached via `lru_cache`; tests must call `get_supabase.cache_clear()` after config reload
- `get_current_user` uses bare `except Exception` — masks 503 network errors as 401
- `payment_events` has RLS enabled but NO user-facing policies — service role only
- `POST /payments/webhook` excluded from auth middleware; HMAC-verified; rejects replays >5 min
- Public storage buckets return unsigned URLs (CDN-cacheable); private buckets return signed URLs (1-hour expiry)
- `/merchants/me` and `/merchants/me/insights` MUST register before `/{id}` in router.py
- Background push tasks have no retry — if Expo Push Service is down, notification is silently lost

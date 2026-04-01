# core/
Shared infrastructure for the LocalStore FastAPI backend: settings, Supabase clients, JWT auth, and Razorpay client.

- `__init__.py` — empty package marker
- `config.py` — Pydantic `Settings` singleton loaded from `.env`
  - exports: `settings` (module-level instance of `Settings`)
  - types: `Settings { supabase_url, supabase_publishable_default_key, supabase_secret_default_key, razorpay_key_id, razorpay_key_secret, razorpay_webhook_secret, sarvam_api_key, llm_api_key, llm_provider, cors_origins, debug }`
  - gotcha: instantiated at module import — missing required env vars raise `ValidationError` on startup

- `auth.py` — FastAPI dependency that validates Bearer JWT and returns user dict
  - exports: `get_current_user` (async function, inject via `Depends(get_current_user)`)
  - returns: `{"id": str, "phone": str, "token": str}`
  - gotcha: bare `except Exception` catches all errors as 401 — masks 503 network errors from Supabase

- `supabase.py` — factory functions for two Supabase client types
  - exports: `get_supabase()` (cached service-role singleton), `get_user_supabase(token)` (per-request user-scoped), `_make_service_client()` (fresh service-role client factory)
  - `get_supabase` uses `supabase_secret_default_key` — bypasses RLS, for: auth admin, payment_events, merchant_insights, background tasks
  - `get_user_supabase` uses `supabase_publishable_default_key` + JWT header — enforces RLS
  - `_make_service_client()` creates fresh service-role client without caching — used by auth endpoints to prevent token mutation corrupting cached client
  - gotcha: `get_supabase` cached via `lru_cache`; tests must call `.cache_clear()` after config reload

- `razorpay.py` — Razorpay API client wrapper (MVP 4+)
  - exports: `RazorpayClient { create_order, fetch_payment, refund }`, `verify_webhook_signature(body, signature, secret)`
  - deps: `httpx` (async HTTP client), `hmac` + `hashlib` (stdlib)
  - pattern: thin wrapper around Razorpay REST API v1, base URL `https://api.razorpay.com/v1`
  - gotcha: `verify_webhook_signature` uses `hmac.compare_digest` for timing-safe comparison

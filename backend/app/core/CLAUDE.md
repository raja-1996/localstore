# core/
Shared infrastructure for the FastAPI backend: settings, Supabase clients, and JWT auth dependency.

- `__init__.py` — empty package marker; no exports
- `config.py` — Pydantic `Settings` singleton loaded from `.env`
  - exports: `settings` (module-level instance of `Settings`)
  - deps: `pydantic_settings`
  - types: `Settings {debug: bool, supabase_url: str, supabase_publishable_default_key: str, supabase_secret_default_key: str, cors_origins: list[str]}`
  - side-effects: reads `.env` file at import time via `SettingsConfigDict`
  - env: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_DEFAULT_KEY`, `SUPABASE_SECRET_DEFAULT_KEY`, `DEBUG`, `CORS_ORIGINS`
  - gotcha: `settings` is instantiated at module import — missing required env vars raise `ValidationError` immediately on startup
- `auth.py` — FastAPI dependency that validates Bearer JWT and returns user dict
  - exports: `get_current_user` (async function, inject via `Depends(get_current_user)`)
  - deps: `./supabase`, `fastapi`
  - types: returns `{"id": str, "email": str, "token": str}`
  - side-effects: calls Supabase Auth API (`supabase.auth.get_user(token)`) on every request
  - gotcha: bare `except Exception` catches all errors and re-raises as 401; Supabase SDK exceptions are not distinguished from network errors
- `supabase.py` — factory functions for two Supabase client types
  - exports: `get_supabase` (cached admin/service-role client), `get_user_supabase` (per-request user-scoped client)
  - deps: `./config`, `supabase` (SDK)
  - side-effects: `get_supabase` makes one `create_client` call (cached via `lru_cache`); `get_user_supabase` creates a new client on every call
  - pattern: singleton (service-role), factory (user-scoped)
  - gotcha: `get_supabase` uses `supabase_secret_default_key` (service role — bypasses RLS); `get_user_supabase` uses `supabase_publishable_default_key` with JWT header to enforce RLS — use the correct client per operation

# services/
Business logic layer for LocalStore — plain Python functions with no HTTP or FastAPI imports. Route handlers in `api/v1/` call these; they are testable without HTTP.

## Why This Layer Exists
The template had all business logic inside route handlers. With ~70 endpoints, extracting logic into service functions:
- Makes business logic testable without HTTP (unit test with mocked Supabase client)
- Keeps route handlers thin: validate → call service → return
- Allows service reuse across routes (e.g., `geo.py` used by feed, search, and need_posts)

## Modules

- `geo.py` — PostGIS query helpers (MVP 1)
  - exports: `nearby_query(lat, lng, radius_m)`, `distance_expression(lat, lng)`
  - deps: none (returns SQL strings for Supabase `.rpc()` calls)
  - pattern: pure functions returning query components, not executing queries

- `search_service.py` — Combined search query builder (MVP 1)
  - exports: `search(q, lat, lng, radius_m, category, min_rating, max_price, supabase)` — returns `{ merchants, services }`
  - deps: calls Supabase RPC functions (`search_merchants`, `search_services`) for pg_trgm + tsvector search
  - pattern: constructs filter params, calls RPC, merges results; no location filtering on services (global search)

- `payment_service.py` — Razorpay integration (MVP 4)
  - exports: `create_order_with_payment(admin, supabase, body, user_id)`, `verify_webhook(body, signature, secret)`, `process_refund(payment_id, amount)`
  - deps: `core/razorpay.py` (httpx client wrapper)
  - gotcha: `merchant_id` derived from `service_id` lookup — never from client request
  - gotcha: webhook verification checks HMAC + replay window (5 min) + event ID uniqueness

- `push_service.py` — Expo push notification dispatch (Sprint 11+)
  - exports: `send_push(token, title, body, data)` (async), `send_bulk_push(tokens, title, body, data)` (async), `get_recipient_push_token(supabase, thread_id, sender_id)` (sync), `get_sender_name(supabase, sender_id)` (sync), `get_follower_push_tokens(supabase, merchant_id)` (sync)
  - deps: `httpx` (async HTTP client), `supabase` (service-role client passed in)
  - gotcha: sync functions required by Supabase Python SDK (synchronous); no retry — if Expo down, notification silently lost

- `recommendation_service.py` — Badge and sharing (MVP 5)
  - exports: `check_badge_threshold(user_id)`, `generate_share_card(recommendation_id)`
  - deps: none (queries Supabase for recommendation count, generates deep-link URL)

- `voice_service.py` — STT → LLM → TTS pipeline (MVP 6)
  - exports: `process_voice_search(audio_bytes, language)`
  - deps: `httpx` for Sarvam.ai and LLM API calls
  - pattern: sequential pipeline — transcribe → extract intent → search → synthesize response

## Key Convention
- NO `from fastapi import ...` in any service file
- Service functions receive Supabase clients as parameters — they don't import `get_supabase`
- Service functions raise plain `ValueError`/`KeyError` — route handlers catch and convert to `HTTPException`

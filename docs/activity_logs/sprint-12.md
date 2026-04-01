# Sprint 12 — Database + Core Infrastructure (Orders/Payments)

**Date:** 2026-04-01
**MVP:** 4 — Transactions
**Status:** Complete

## Tasks

| # | Task | Status |
|---|------|--------|
| 12.1 | Migration `012_orders.sql` — orders + payment_events tables, RLS, Realtime, indexes | Done |
| 12.2 | `core/razorpay.py` — httpx async client + HMAC webhook verification | Done |
| 12.3 | Update `config.py` — razorpay_key_id, razorpay_key_secret, razorpay_webhook_secret | Done |
| 12.4 | Unit tests: `test_razorpay.py` — 14 tests (HMAC, client methods, migration check) | Done |

## Files Created
- `supabase/migrations/012_orders.sql`
- `backend/app/core/razorpay.py`
- `backend/tests/test_razorpay.py`

## Files Modified
- `backend/app/core/config.py` — added 3 Razorpay settings

## Test Results
- 14/14 razorpay tests pass (0.12s)
- No regressions in existing tests (255 passed; 17 pre-existing auth failures unrelated)

## Review Highlights
- Fixed HMAC bypass when webhook secret is empty string
- Added async context manager support to RazorpayClient
- Made payment_events.order_id nullable per spec (webhook events may arrive without matched order)
- Added SQL comment documenting that column-level UPDATE restrictions must be enforced at API layer

## Next
- Sprint 13: Schemas + Payment Service

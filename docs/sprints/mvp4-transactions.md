# MVP4 Transactions — Sprint Plan

Hyperlocal services marketplace. Orders + Payments (Razorpay) + Status Tracker.
Sprints 12–18. ~30 tasks, 11 new files, 5 modified files, 13 test files.

---

## Sprint 12: Database + Core Infrastructure

**Goal:** Orders/payment_events tables exist, Razorpay client wired up.

| # | Task | Size | Deps | Done Criteria |
|---|------|------|------|---------------|
| 12.1 | Migration `012_orders.sql` — orders + payment_events tables, RLS, Realtime, indexes | M | None | `supabase db reset` succeeds; RLS prevents non-participant access |
| 12.2 | `core/razorpay.py` — httpx client (`create_order`, `fetch_payment`, `refund`) + HMAC verify | M | None | Client instantiable; HMAC returns True/False correctly |
| 12.3 | Update `config.py` — add `razorpay_key_id`, `razorpay_key_secret`, `razorpay_webhook_secret` | S | None | App starts without keys (defaults to empty string) |
| 12.4 | Unit tests: `test_razorpay.py` — HMAC valid/invalid/empty/tampered + migration check | M | 12.1-12.3 | All tests pass |

- **Parallel:** 12.1, 12.2, 12.3 all independent
- **Risk:** Generated column syntax for `balance_amount` may vary across Postgres versions
- **Exit:** `supabase db reset` passes with 12 migrations; Razorpay client tested

---

## Sprint 13: Schemas + Payment Service

**Goal:** Order creation produces Razorpay order; webhook HMAC works in tests.

| # | Task | Size | Deps | Done Criteria |
|---|------|------|------|---------------|
| 13.1 | `schemas/orders.py` — OrderCreate (NO merchant_id), OrderResponse, StatusUpdate, ReorderResponse | M | None | Pydantic rejects `merchant_id` in body |
| 13.2 | `schemas/payments.py` — PaymentVerify, WebhookPayload, RefundRequest/Response | S | None | Schema validates correctly |
| 13.3 | `services/payment_service.py` — create_order_with_payment, verify_webhook (HMAC + replay + idempotency), verify_client_payment, process_refund | L | 12.1, 12.2, 13.1, 13.2 | Derives merchant_id from service_id; advance = price * qty * percent/100 |
| 13.4 | Unit tests: `test_order_schemas.py` + `test_payment_service.py` (15+ cases) | L | 13.3 | Happy path + all edge cases covered |

- **Parallel:** 13.1, 13.2 independent
- **Risk:** Paise conversion — Razorpay expects int, DB stores decimal
- **Exit:** Payment service tested with mocked Razorpay + Supabase

---

## Sprint 14: Backend Routes + Router

**Goal:** All 8 endpoints respond correctly; state machine enforces transitions.

| # | Task | Size | Deps | Done Criteria |
|---|------|------|------|---------------|
| 14.1 | `api/v1/orders.py` — POST /orders, GET /orders (role+status+cursor), GET /orders/{id}, PATCH /orders/{id}/status (VALID_TRANSITIONS), POST /orders/{id}/reorder | L | 13.3 | State machine rejects invalid transitions with 400 |
| 14.2 | `api/v1/payments.py` — POST /payments/webhook (NO auth, HMAC only), POST /payments/verify, POST /orders/{id}/refund (merchant only) | L | 13.3 | Webhook works without Bearer token |
| 14.3 | `send_order_push` in `background/push_tasks.py` | S | None | Push dispatched on status change |
| 14.4 | Update `router.py` — register orders + payments routers | S | 14.1, 14.2 | All 8 endpoints in OpenAPI docs |
| 14.5 | Unit tests: `test_orders.py` + `test_payments.py` (25+ cases) — state transitions, HMAC, roles | L | 14.1-14.4 | All transitions exhaustively tested |

- **Parallel:** 14.1, 14.2, 14.3 all independent
- **Risk:** Webhook must bypass JWT middleware — verify unauthenticated calls succeed
- **Exit:** All 8 endpoints pass TestClient tests

---

## Sprint 15: Frontend Services + Order List

**Goal:** Users see order history in scrollable list with filters.

| # | Task | Size | Deps | Done Criteria |
|---|------|------|------|---------------|
| 15.1 | `services/order-service.ts` — create, list, get, updateStatus, reorder | M | Sprint 14 | Correct HTTP calls; TS types match backend |
| 15.2 | `services/payment-service.ts` — verify function | S | Sprint 14 | Posts to `/payments/verify` |
| 15.3 | `orders/index.tsx` — useInfiniteQuery, role toggle, status filter tabs, order cards, pull-to-refresh, empty state | L | 15.1 | List renders; filters work; empty state shown |
| 15.4 | Add Orders tab to `(app)/_layout.tsx` | S | 15.3 | Tab visible and navigates correctly |
| 15.5 | Frontend tests: `order-service.test.ts` (MSW) + `orders-screen.test.tsx` | M | 15.1, 15.3 | All tests pass with MSW |

- **Parallel:** 15.1, 15.2 independent
- **Risk:** 5th bottom tab may crowd small screens
- **Exit:** Order list renders with mock data; filters work

---

## Sprint 16: Razorpay SDK + Order Creation Flow

**Goal:** User books service, pays via Razorpay, sees order in list.

| # | Task | Size | Deps | Done Criteria |
|---|------|------|------|---------------|
| 16.1 | Install + configure `react-native-razorpay`, Expo config plugin | M | None | Dev build succeeds; test mode accessible |
| 16.2 | "Book Now" flow on merchant service detail — qty selector, requirements, image upload, Razorpay checkout | L | 15.1, 15.2, 16.1 | User taps Book Now, pays, sees order confirmation |
| 16.3 | Handle Razorpay callbacks — success (verify + navigate), failure (retry), timeout (pending state) | M | 16.2 | All three paths handled; no dead-end states |
| 16.4 | Frontend tests: `order-creation.test.tsx` — mock Razorpay module, success/failure/validation | M | 16.2, 16.3 | All paths tested |

- **Risk:** `react-native-razorpay` may conflict with Expo new architecture
- **Exit:** Full payment flow works in Razorpay test mode

---

## Sprint 17: Status Tracker + Realtime

**Goal:** Live order status updates via Supabase Realtime with visual stepper.

| # | Task | Size | Deps | Done Criteria |
|---|------|------|------|---------------|
| 17.1 | `orders/[id].tsx` — detail screen, visual step tracker (pending > confirmed > in_progress > ready > delivered), role-based action buttons | L | 15.1, Sprint 14 | Stepper reflects status; buttons match allowed transitions |
| 17.2 | Supabase Realtime subscription — `postgres_changes` on orders, update TanStack cache | M | 17.1 | Status changes appear in <2s without polling |
| 17.3 | Reorder — "Order Again" button for delivered orders, opens Razorpay | M | 16.2, 17.1 | One-tap reorder creates new order |
| 17.4 | Frontend tests: `order-detail.test.tsx` — all statuses, role buttons, Realtime mock, reorder | M | 17.1-17.3 | All status states + roles tested |

- **Risk:** Realtime filter syntax must match exactly (`id=eq.{orderId}`)
- **Exit:** Live updates work; merchant can advance full lifecycle

---

## Sprint 18: Integration Tests + E2E

**Goal:** Full confidence with live Supabase tests + Maestro E2E.

| # | Task | Size | Deps | Done Criteria |
|---|------|------|------|---------------|
| 18.1 | Test factories: `makeOrder()`, `makePaymentEvent()` (backend + frontend) | S | None | Factories match DB schema |
| 18.2 | Backend integration: `test_orders_integration.py` + `test_payments_integration.py` against live Supabase | L | Sprints 12-14, 18.1 | Tests pass with `supabase start` + `uvicorn` |
| 18.3 | Frontend integration: `order-integration.test.ts` — full user journey (MSW) | M | Sprints 15-17, 18.1 | Complete flow tested |
| 18.4 | Maestro E2E: `booking-flow.yaml` — navigate > book > pay > verify in list | L | Sprints 15-17 | Flow completes on simulator |

- **Parallel:** 18.2, 18.3 independent; 18.1 first
- **Risk:** Maestro can't interact with Razorpay native sheet — fallback to partial flow
- **Exit:** All tests green

---

## Dependency Graph

```
Sprint 12 → Sprint 13 → Sprint 14 → Sprint 15 → Sprint 16 → Sprint 17 → Sprint 18
                                        ↘ 16.1 (can start early)
```

## Files Summary

### New Files (11)
| File | Sprint |
|------|--------|
| `supabase/migrations/012_orders.sql` | 12 |
| `backend/app/core/razorpay.py` | 12 |
| `backend/app/schemas/orders.py` | 13 |
| `backend/app/schemas/payments.py` | 13 |
| `backend/app/services/payment_service.py` | 13 |
| `backend/app/api/v1/orders.py` | 14 |
| `backend/app/api/v1/payments.py` | 14 |
| `app/src/services/order-service.ts` | 15 |
| `app/src/services/payment-service.ts` | 15 |
| `app/src/app/(app)/orders/index.tsx` | 15 |
| `app/src/app/(app)/orders/[id].tsx` | 17 |

### Modified Files (5)
| File | Sprint | Change |
|------|--------|--------|
| `backend/app/core/config.py` | 12 | Add 3 Razorpay settings |
| `backend/app/background/push_tasks.py` | 14 | Add `send_order_push` |
| `backend/app/api/v1/router.py` | 14 | Register orders + payments routers |
| `app/src/app/(app)/_layout.tsx` | 15 | Add Orders tab |
| `backend/tests/conftest.py` | 14 | Add payments mock patches |

### Test Files (13)
| File | Sprint |
|------|--------|
| `backend/tests/test_razorpay.py` | 12 |
| `backend/tests/test_order_schemas.py` | 13 |
| `backend/tests/test_payment_service.py` | 13 |
| `backend/tests/test_orders.py` | 14 |
| `backend/tests/test_payments.py` | 14 |
| `backend/tests/integration/test_orders_integration.py` | 18 |
| `backend/tests/integration/test_payments_integration.py` | 18 |
| `app/src/__tests__/order-service.test.ts` | 15 |
| `app/src/__tests__/orders-screen.test.tsx` | 15 |
| `app/src/__tests__/order-creation.test.tsx` | 16 |
| `app/src/__tests__/order-detail.test.tsx` | 17 |
| `app/src/__tests__/order-integration.test.ts` | 18 |
| `e2e/maestro/booking-flow.yaml` | 18 |

## Test Coverage Summary
| Type | Cases | Sprints |
|------|-------|---------|
| Backend unit | ~40+ | 12, 13, 14 |
| Frontend unit | ~20+ | 15, 16, 17 |
| Backend integration | 2 suites | 18 |
| Frontend integration | 1 suite | 18 |
| E2E (Maestro) | 1 flow | 18 |

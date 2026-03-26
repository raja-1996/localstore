# Activity Log

## [2026-03-22] — Profile Endpoint + Integration Tests

- Created `GET /api/v1/profile` + `PATCH /api/v1/profile` endpoints
- Schema: `ProfileResponse` (all fields including push_token) + `ProfileUpdateRequest` (full_name, avatar_url)
- Router registered in `router.py`; user-scoped Supabase client enforces RLS
- 8 unit tests + 8 integration tests; all pass; full suite 139 passed, 1 skipped
- Gotcha: `exclude_unset=True` (not `exclude_none`) for correct partial PATCH semantics

---

## [2026-03-22] — Phone OTP: E2E Maestro Flow + Navigation Bug Fix

- Fixed `phone-login.tsx` missing `router.replace('/(app)/todos')` after `verifyPhoneOtp` — verify button did nothing; store set `isAuthenticated: true` but navigation never triggered
- Root cause: `index.tsx` auth guard only runs on mount; it does not re-evaluate while the user is deep in the `(auth)` stack
- Split Maestro flow into two phases to fix OTP timing mismatch:
  - `07a-phone-login-trigger.yaml` — launches app, navigates to phone login, enters phone, taps Send Code, stops at OTP screen
  - `07b-phone-login-verify.yaml` — enters SMS code, taps Verify, asserts Todos screen (no `clearState`, app stays on OTP screen)
- Old combined flow (`07-phone-login-flow.yaml`) failed because it triggered a new OTP but was passed a pre-known code — never matched
- All 79 unit tests still pass after the `router.replace` fix

---

## [2026-03-22] — Phone OTP: Frontend (auth store, settings, tests)

- Added `phone: string | null` to `User` interface in `auth-store.ts` and `AuthResponse.user` in `auth-service.ts`
- Supabase returns `email: ""` for phone-only users; `email` typed as `string | null` to model this correctly
- `settings.tsx`: avatar initial falls back to `user.phone[0]`, label shows "Phone"/"Email" conditionally, value shows phone when email empty
- Fixed OTP validation in `phone-login.tsx`: `!/^\d{6}$/.test(otp)` replaces `otp.length !== 6` — rejects non-numeric 6-char strings
- Added `PhoneLoginScreen` describe block to `screens.test.tsx` (16 tests total)
- Fixed pre-existing `expo-router` mock: added `replace` to `useRouter()` — previously missing, caused 2 test failures
- Fixed test isolation bug: `useAuthStore.mockImplementation` was leaking from `renders fallback text when user is null` test into `PhoneLoginScreen` tests
- Total screens tests: 79 pass

---

## [2026-03-22] — Phone OTP: Integration Tests

- Added `TestPhoneOTPIntegration` to `test_auth_integration.py`
- `test_send_phone_otp` — sends OTP to `+919182666194` via Twilio/Supabase, asserts 200
- `test_verify_phone_otp` — reads `TEST_PHONE_OTP` env var (skips if unset), verifies OTP, asserts tokens + phone field
- Gotcha: Supabase returns phone without leading `+` (`919182666194` not `+919182666194`) — use `.lstrip("+")`
- Gotcha: Supabase returns `email: ""` (empty string) for phone-only users, not `None` — assert `not data["user"]["email"]`
- Both tests pass against real Twilio/Supabase

---

## [2026-03-22] — Phone OTP: Backend Fixes + Tests

- Fixed `_build_auth_response` to include `phone` field via `getattr(session.user, "phone", None)`
- Fixed signup no-session path to include `"phone": None` in hardcoded user dict
- Removed `[DEBUG LOGIN]` print that was leaking password to stdout
- Added `phone=None` param to `make_mock_session` in `conftest.py`; set `session.user.phone`
- Added `"phone": None` to `MOCK_USER` in `conftest.py`
- Added `test_verify_otp_phone_user_no_email` — verifies phone-only user (email=None) returns correct tokens + phone field
- Added `test_send_otp_missing_phone` — verifies 422 on empty request body
- All 66 unit tests pass

---

## [2026-03-22] — Push Notifications: Send Endpoint (Backend)

- Added `send_push_notification(token, title, body, data)` to `backend/app/core/notifications.py` — calls Expo Push API via `httpx.AsyncClient` with 10s timeout
- Added `SendNotificationRequest` + `SendNotificationResponse` schemas to `backend/app/schemas/notifications.py`
- Added `POST /api/v1/notifications/send` to `backend/app/api/v1/notifications.py` — looks up recipient push token (service-role), calls Expo, returns success
- 6 new unit tests in `backend/tests/test_notifications.py` (success, user not found, no token, 502, 500, no auth) — all pass
- 3 new integration tests in `backend/tests/integration/test_notifications_integration.py` — all pass
- Gotcha: `/send` has no per-user authorization by design (template app); comment added flagging this for production

---

## [2026-03-22] — Push Notifications Frontend

- Created `app/src/services/notifications-service.ts` — thin service wrapper: `registerToken(token)` → `POST /notifications/register-token`
- Updated `app/src/lib/notifications.ts` to use `notificationsService.registerToken` instead of calling `api.post` directly
- Updated `app/src/app/(app)/_layout.tsx` — added `useEffect` on mount: calls `registerForPushNotifications()`, attaches foreground + tap listeners, cleans up on unmount
- Tap listener extracts `todoId` from notification data and navigates to `/(app)/todo-detail?id=<todoId>`
- Created `app/src/__tests__/notifications-service.test.ts` (5 tests) + `app/src/__tests__/notifications.test.ts` (7 tests) — all 12 pass

---

## [2026-03-22] — Realtime Playground: Screen + E2E Flow

- Created `app/src/app/(app)/realtime.tsx` — single Supabase channel with postgres_changes, presence, and broadcast counter
- Created `e2e/maestro/06-realtime-flow.yaml` — full E2E flow: login → Realtime tab → increment counter × 2 → create todo → assert INSERT in log
- Fix: `{ config: { broadcast: { self: true } } }` on channel creation — Supabase does not echo broadcasts to sender by default
- Fix: `supabase.realtime.setAuth(accessToken)` before subscribe — required for RLS-protected postgres_changes on `todos`
- Verified: `todos` in `supabase_realtime` publication, all 4 RLS policies confirmed via Supabase CLI
- Flow 06 passes on Pixel_9_Pro (emulator-5554); all 6 Maestro flows green

---

## [2026-03-22] — Librarian: Mobile App CLAUDE.md Refresh

- Updated `app/src/__tests__/CLAUDE.md`: was missing 8 of 10 test files; now covers all unit + integration tests
- Refreshed all 10 CLAUDE.md files in `app/` subtree with accurate, current content
- Folders indexed: app, src, app/routes, (app), (auth), components, constants, hooks, lib, services, stores, __tests__

---

## [2026-03-22] — E2E: All 5 Maestro Flows Pass

- Flows 02 (login), 03 (logout), 05 (auth guard): passed as-is
- Flow 01 (signup): fixed `router.replace` missing after auth; timeout bumps; dynamic email via `--env`
- Flow 04 (todo CRUD): fixed `tapOn: "Sign In"` → `tapOn: id: "login-button"`; removed `hideKeyboard` before button taps (shifts ScrollView, pushes buttons out of view)
- Device: Pixel_9_Pro (emulator-5554), Maestro 2.3.0
- Source changes: added `testID` to FAB, title-input, description-input, login/signup buttons; added `router.replace` to login.tsx + signup.tsx

---

## [2026-03-22] — E2E Tests: 5 Maestro Flows Created

- Flows: signup, login, logout, todo CRUD, auth guard
- Source changes: `testID="fab-button"` on FAB, `testID="title-input"` + `testID="description-input"` on todo-detail inputs
- `app/package.json`: added `test:e2e` script

---

## [2026-03-22] — Frontend Integration Tests: 244/245 Pass

- 10/10 suites, 244 pass, 1 skip (deleteAccount — admin API blocked)
- Fix: added `@jest-environment node` to `storage-integration.test.ts` (axios browser adapter mangled multipart)

---

## [2026-03-21] — Screen Tests: 63 Pass

- LoginScreen, SignupScreen, TodosScreen, SettingsScreen
- Fixes: testID-based selectors, cancel handler tests, act() boundaries
- Source changes: testIDs added to login.tsx, signup.tsx, settings.tsx, todo-card.tsx

---

## [2026-03-21] — Component Tests: 28 Pass

- Button, Input, ThemedText, ThemedView, TodoCard
- Infra: upgraded jest-expo 52→55, react-test-renderer@19, jest-expo preset

---

## [2026-03-21] — Mobile Storage Tests: 20 Pass (10 unit + 10 integration)

- Fix: Supabase Storage returns 204 on RLS-blocked deletes (not an error); test verifies file still exists

---

## [2026-03-21] — Mobile Todos Tests: 65 Pass (43 unit + 22 integration)

- Fix: `image_path: null` PATCH returns 400 — `model_dump(exclude_none=True)` strips nulls; documented in test

---

## [2026-03-21] — Mobile Auth Tests: 68 Pass (59 unit + 9 integration, 1 skip)

- Skip: `DELETE /auth/account` blocked by Supabase project permissions
- Fix: `accessToken`/`refreshToken` out of scope in catch block → `ReferenceError` on network error

---

## [2026-03-21] — Backend: Migrated to New Supabase Project

- 111/111 tests pass (54 integration + 57 unit) against `whhwbhhcxnzdbfqghyeg.supabase.co`
- Fix: new project rejects `@example.com` emails → changed to `@gmail.com`

---

## [2026-03-21] — Backend Storage Tests: 33 Pass (17 unit + 16 integration)

- Created `uploads` bucket + `003_storage_policies.sql` (RLS for upload/download/delete)
- Fix: `_bucket_exists()` used stale LRU-cached credentials; cleared cache before check

---

## [2026-03-21] — Push Notifications Backend

- `POST /api/v1/notifications/register-token` — saves Expo push token to `profiles.push_token`
- Migration `002_add_push_token.sql` applied; 7/7 unit + 7/7 integration tests pass

---

## [2026-03-21] — Backend Todos Integration Tests: 19 Pass

- Applied `001_initial_schema.sql`; linked remote Supabase project
- Test user auto-created/deleted per session via `conftest.py`

---

## [2026-03-21] — Auth Testing Setup

- Backend: 11/11 integration tests pass against real Supabase
- Mobile: `auth-service.test.ts` (23) + `auth-store.test.ts` (36) — 66 tests total
- Fix: `jest.config.js` added `@babel/preset-typescript`; auth-store `ReferenceError` in catch block fixed

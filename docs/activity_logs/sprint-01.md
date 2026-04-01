## [2026-03-28] — Sprint 1: Auth (Backend + Frontend)

- Renamed OTP routes: `POST /auth/phone/send-otp` → `POST /auth/otp/send`, `POST /auth/phone/verify-otp` → `POST /auth/otp/verify`
- Renamed `OTPVerifyRequest.otp` → `OTPVerifyRequest.token` (aligns with Supabase `verify_otp` API field name)
- Added E.164 phone validation to `OTPRequest` and `OTPVerifyRequest` (regex `^\+[1-9]\d{6,14}$`)
- Renamed `profile.py` → `users.py` at `/users/me` prefix; `schemas/profile.py` → `schemas/users.py` with `UserProfile`, `UserUpdate`, `PushTokenRequest`
- `UserProfile` includes `email: str | None` field (Supabase phone-only users return `email: ""`, not null)
- Deleted stale `profile.py`, `test_profile.py`, `test_profile_integration.py`, `schemas/profile.py`
- Created `test_auth_schemas.py` (22 tests: E.164 boundary values, field validation)
- Created `test_users.py` + `test_users_integration.py` (mirrors old profile tests at new `/users/me` paths)
- Updated `auth-service.ts`: URL + payload changes; `verifyPhoneOtp(phone, token)` (was `otp`)
- Backend: 85 unit tests pass; Frontend: 126 unit tests pass (1 skip: TEST_PHONE_OTP not set)
- Gotcha: Removing a router from `router.py` 404s all its tests — delete the route file AND test file together
- Gotcha: Integration tests must not import from sibling test files — use pytest fixtures only

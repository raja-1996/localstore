## [2026-03-28] — Sprint 0: Foundation (LocalStore scaffold)

- Created DB migrations 004–008: PostGIS+pg_trgm extensions, LocalStore profiles schema (phone, is_merchant, badge), merchants table (PostGIS GEOGRAPHY column, search_vector tsvector, GIST index), services+portfolio_images tables, storage buckets (user-avatars, merchant-avatars, portfolio-images)
- Added `is_merchant` sync trigger on merchants INSERT/DELETE → keeps `profiles.is_merchant` consistent
- Created `backend/app/schemas/common.py`: `CursorParams` + `PaginatedResponse[T]` generics for all paginated endpoints
- Created `app/src/stores/location-store.ts`: Zustand store with coords, permissionStatus, isStale() (10-min threshold), refreshLocation() with isLoading guard
- Cleaned up all template code: removed todos, notifications, realtime routes/screens/services/hooks/tests from both backend and frontend
- Backend router now registers only: auth, storage, profile (Sprint 1 will add auth OTP, Sprint 2 will add merchants)
- Frontend (app)/_layout.tsx has settings-only tab; index.tsx redirects to settings until feed screen exists
- Backend: 63 unit tests pass; Frontend: 170 unit tests pass
- Gotcha: `requestPermission` must map Expo 'undetermined' → 'undetermined' (not 'denied'); collapsing it blocks OS re-prompting
- Gotcha: `refreshLocation` should skip permission re-request when `permissionStatus === 'granted'`

---

## [2026-03-28] — Sprint 0: Visual Testing on Real Supabase

- Connected to remote Supabase project (hotoieasvetwyecmrytj, Mumbai)
- Pushed all 8 migrations successfully via `supabase db push`
- Fixed `app.json`: name→LocalStore, slug→localstore, package→com.raja.localstore (was clashing with old template app)
- Fixed Android emulator API URL: `localhost:8000` → `10.0.2.2:8000` (Android emulator cannot reach host via localhost)
- Fixed post-login redirect in `phone-login.tsx` and `login.tsx`: `/(app)/todos` → `/(app)/settings` (todos deleted in Sprint 0)
- Made phone login the default entry point: `index.tsx` now redirects unauthenticated users to `/(auth)/phone-login`
- Phone OTP via Twilio working end-to-end on Pixel_9_Pro emulator
- Settings screen visible after OTP verification — Sprint 0 fully verified

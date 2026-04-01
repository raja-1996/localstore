# __tests__
Jest test suite for the mobile app — unit tests (mocked) and integration tests (real HTTP to backend).

## Unit Tests (mocked — run always)

- `auth-service.test.ts` — tests `authService`: signup, login, logout, refresh, sendPhoneOtp, verifyPhoneOtp, deleteAccount
  - deps: `../services/auth-service`, `../lib/api`
  - pattern: mocks `../lib/api` entirely; asserts correct endpoints and payloads are called
  - endpoints tested: `/auth/otp/send`, `/auth/otp/verify` (uses `token` field, not `otp`)
  - gotcha: 19 test cases across 6 describe blocks; `jest.clearAllMocks()` in `beforeEach`

- `auth-store.test.ts` — tests `useAuthStore`: all 7 actions plus `restoreSession` edge cases
  - deps: `../stores/auth-store`, `../services/auth-service`, `expo-secure-store`
  - pattern: mocks `authService` + `expo-secure-store`; resets Zustand store in `beforeEach` via `useAuthStore.setState`
  - gotcha: `restoreSession` covered by 10 test cases — success, 401, network error, no tokens, partial tokens, SecureStore throw
  - gotcha: Zustand state persists across tests without explicit `setState` reset in `beforeEach`

- `location-store.test.ts` — tests `useLocationStore`: location permission requests and position updates
  - deps: `../stores/location-store`, `expo-location`
  - pattern: mocks `expo-location`; tests permission state transitions and error handling

- `components.test.tsx` — RNTL tests for Button, Input, ThemedText, ThemedView, MerchantCard, CategoryFilterBar, SkeletonCard
  - deps: `../components/*`, `../hooks/use-theme` (mocked to light palette)
  - pattern: `jest.mock('../hooks/use-theme')` at top; uses `flatStyle` helper to flatten StyleSheet refs
  - gotcha: imports components AFTER mocking `use-theme` — import order matters here

- `screens.test.tsx` — RNTL tests for SettingsScreen
  - deps: `../app/(app)/settings`, `../hooks/use-theme`, `../stores/auth-store`, `expo-router`
  - pattern: mocks `use-theme`, `auth-store`, `expo-router`
  - gotcha: selectors use `testID` props (e.g., `logout-button`)

## Integration Tests (real HTTP — opt-in)

Integration tests hit the real backend. They are skipped unless the backend is reachable or `RUN_INTEGRATION=true`.

- `auth-integration.test.ts` — real HTTP tests for all auth endpoints
  - pattern: plain `axios` instance (no expo-secure-store interceptors); `validateStatus: () => true`
  - endpoints tested: `/auth/otp/send`, `/auth/otp/verify` (expects `token` field in request)
  - env: `EXPO_PUBLIC_API_URL` (default: `http://localhost:8000`); `TEST_PHONE` (default: `+919182666194`); `TEST_PHONE_OTP` (optional — skips verify-otp if unset)
  - gotcha: uses a helper `authedClient(token)` factory for authenticated requests
  - gotcha: `verify-otp` test skips unless `TEST_PHONE_OTP=<code>` is set — requires real SMS; backend returns 401 (not 400/422) for invalid OTP

- `format-distance.test.ts` — unit tests for distance formatting utility
  - tests: meter-to-km conversion, edge cases (0m, 999m, 1000m, 10km)

- `feed-service.test.ts` — unit tests for feedService (mocked axios)
  - tests: getNearbyFeed with coords, pagination, category filter, response structure

- `merchant-service.test.ts` — unit tests for merchantService (mocked axios)
  - tests: getMerchant, getServices, getPortfolio, response structure validation

- `feed-screen.test.tsx` — RNTL tests for NearbyFeedScreen
  - deps: feed/index.tsx, hooks/use-feed, stores/location-store
  - tests: renders location permission interstitial, feed list on granted, FlashList rendering

- `merchant-screen.test.tsx` — RNTL tests for MerchantDetailScreen
  - deps: merchant/[id].tsx, hooks/use-merchant
  - tests: merchant detail rendering, 3 parallel API calls via Promise.all, error states

- `search-service.test.ts` — unit tests for searchService
  - tests: search merchants, search services, combined results, category filter

- `user-service.test.ts` — unit tests for userService
  - tests: getProfile, updateProfile, saveMerchant mutations

- `search-screen.test.tsx` — RNTL tests for SearchScreen
  - deps: app/(app)/search/index.tsx, hooks/use-search
  - tests: search input, category filtering, result rendering, empty state

- `profile-screen.test.tsx` — RNTL tests for ProfileScreen
  - deps: app/(app)/profile/index.tsx, hooks/use-user-profile
  - tests: profile loading, saved merchants list, profile edit modal

- `merchant-create-screen.test.tsx` — RNTL tests for MerchantCreateScreen
  - deps: app/(app)/merchant/create.tsx, services/merchant-service
  - tests: form validation, location auto-fill, merchant creation submit

- `chat-service.test.ts` — unit tests for chatService (mocked axios)
  - deps: ../services/chat-service, ../lib/api
  - tests: getThreads with pagination, createThread, getMessages, sendMessage, markRead; validates payloads and query params

- `chat-screen.test.tsx` — RNTL tests for ChatListScreen and ChatDetailScreen
  - deps: app/(app)/chat/index.tsx, app/(app)/chat/[threadId].tsx, hooks/use-chat, stores/chat-store
  - tests: thread list rendering, message list with inverted order, send message optimistic update, mark read on mount/new message

- `push-registration.test.ts` — unit tests for push notification registration and tap navigation (Sprint 11)
  - tests: `usePushNotifications` hook; token registration on auth; double-registration guard; notification tap navigation; cold-start deep links; 7 test cases
  - deps: mocked `expo-notifications`, `expo-device`, `expo-router`, `user-service`, `auth-store`

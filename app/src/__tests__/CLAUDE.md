# __tests__
Jest test suite for the mobile app — unit tests (mocked) and integration tests (real HTTP to backend).

## Unit Tests (mocked — run always)

- `auth-service.test.ts` — tests `authService`: signup, login, logout, refresh, sendPhoneOtp, verifyPhoneOtp, deleteAccount
  - deps: `../services/auth-service`, `../lib/api`
  - pattern: mocks `../lib/api` entirely; asserts correct endpoints and payloads are called
  - gotcha: 19 test cases across 6 describe blocks; `jest.clearAllMocks()` in `beforeEach`

- `auth-store.test.ts` — tests `useAuthStore`: all 7 actions plus `restoreSession` edge cases
  - deps: `../stores/auth-store`, `../services/auth-service`, `expo-secure-store`
  - pattern: mocks `authService` + `expo-secure-store`; resets Zustand store in `beforeEach` via `useAuthStore.setState`
  - gotcha: `restoreSession` covered by 10 test cases — success, 401, network error, no tokens, partial tokens, SecureStore throw
  - gotcha: Zustand state persists across tests without explicit `setState` reset in `beforeEach`

- `todos-service.test.ts` — tests `todosService`: list, get, create, update, delete
  - deps: `../services/todos-service`, `../lib/api`
  - pattern: mocks `../lib/api` (get, post, patch, delete); 25 test cases across 5 describe blocks

- `storage-service.test.ts` — tests `storageService`: upload, getUrl, delete
  - deps: `../services/storage-service`, `../lib/api`
  - pattern: mocks `../lib/api`; verifies multipart header override on upload

- `use-todos.test.ts` — tests `useTodos`, `useTodo`, `useCreateTodo`, `useUpdateTodo`, `useDeleteTodo` hooks
  - deps: `../hooks/use-todos`, `../services/todos-service`, `@tanstack/react-query`
  - pattern: mocks `@tanstack/react-query` and `todosService`; captures queryKey/mutationFn args
  - gotcha: `useTodo` is disabled when `id` is falsy — tested explicitly

- `components.test.tsx` — RNTL tests for Button, Input, ThemedText, ThemedView, TodoCard
  - deps: `../components/*`, `../hooks/use-theme` (mocked to light palette)
  - pattern: `jest.mock('../hooks/use-theme')` at top; uses `flatStyle` helper to flatten StyleSheet refs
  - gotcha: imports components AFTER mocking `use-theme` — import order matters here

- `screens.test.tsx` — RNTL tests for LoginScreen, SignupScreen, TodosScreen, SettingsScreen
  - deps: `../app/(auth)/login`, `../app/(auth)/signup`, `../app/(app)/todos`, `../app/(app)/settings`
  - pattern: mocks `use-theme`, `auth-store`, `use-todos`, `expo-router`, `expo-image-picker`, `storage-service`
  - gotcha: selectors use `testID` props (e.g., `login-button`, `fab-button`, `avatar-pressable`)
  - gotcha: `act()` boundaries required around async state updates (Alert callbacks, async handlers)

## Integration Tests (real HTTP — opt-in)

Integration tests hit the real backend. They are skipped unless the backend is reachable or `RUN_INTEGRATION=true`.

- `auth-integration.test.ts` — real HTTP tests for all auth endpoints
  - pattern: plain `axios` instance (no expo-secure-store interceptors); `validateStatus: () => true`
  - env: `EXPO_PUBLIC_API_URL` (default: `http://localhost:8000`); `TEST_PHONE` (default: `+919182666194`); `TEST_PHONE_OTP` (optional — skips verify-otp if unset)
  - gotcha: uses a helper `authedClient(token)` factory for authenticated requests
  - gotcha: `verify-otp` test skips unless `TEST_PHONE_OTP=<code>` is set — requires real SMS; backend returns 401 (not 400/422) for invalid OTP

- `todos-integration.test.ts` — real HTTP tests for `/api/v1/todos` endpoints
  - pattern: standalone axios; opt-in via `RUN_INTEGRATION=true`
  - env: `TEST_API_URL`, `TEST_EMAIL`, `TEST_PASSWORD` (defaults: `http://localhost:8000`, `todo-test@example.com`, `TestPass123!`)

- `storage-integration.test.ts` — real HTTP tests for `/api/v1/storage` endpoints
  - pattern: standalone axios; uses `form-data` npm package for multipart in Node.js
  - env: `TEST_API_URL`, `TEST_EMAIL`, `TEST_PASSWORD`
  - gotcha: `@jest-environment node` annotation is required — axios browser adapter breaks multipart in jsdom

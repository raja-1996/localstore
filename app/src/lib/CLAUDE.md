# lib
Infrastructure singletons: HTTP client, Supabase client, React Query client, and push notification setup.

- `api.ts` — configured Axios instance with auth token injection and auto-refresh on 401
  - exports: `api` (default)
  - deps: `expo-secure-store`, `axios`
  - env: `EXPO_PUBLIC_API_URL` (defaults to `http://localhost:8000`)
  - side-effects: reads `access_token` / `refresh_token` from SecureStore on every request; writes new tokens on successful refresh
  - pattern: singleton axios instance with request + response interceptors
  - gotcha: on 401, retries original request exactly once (`_retry` flag); if refresh also fails, deletes tokens from SecureStore — but does NOT redirect/logout from here
  - gotcha: do NOT import this file in Node.js test environments (uses `expo-secure-store`); use standalone axios in integration tests

- `notifications.ts` — Expo push notification setup: permission request, token registration, listener helpers
  - exports: `registerForPushNotifications`, `addNotificationListener`, `addNotificationResponseListener`
  - deps: `./api`, `expo-notifications`, `expo-device`
  - side-effects: sets global notification handler on module load (`Notifications.setNotificationHandler`); calls `POST /notifications/register-token`
  - gotcha: returns `null` silently on simulators (`!Device.isDevice`); backend token registration failure is silently swallowed

- `query-client.ts` — shared TanStack Query `QueryClient` singleton with app-wide defaults
  - exports: `queryClient`
  - pattern: singleton
  - gotcha: `staleTime` is 5 minutes; `refetchOnWindowFocus: false` — data does NOT auto-refresh when app comes to foreground

- `supabase.ts` — Supabase JS client for Realtime WebSocket only (not for REST API calls)
  - exports: `supabase`
  - deps: `@supabase/supabase-js`, `react-native-url-polyfill/auto`
  - env: `EXPO_PUBLIC_SUPABASE_URL` (defaults to `http://localhost:54321`), `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
  - side-effects: imports URL polyfill as module side-effect (required for React Native)
  - gotcha: `SUPABASE_KEY` defaults to empty string if env var is missing — client created but all requests fail
  - gotcha: used ONLY for Realtime in `realtime.tsx`; all REST API calls go through FastAPI via `api.ts`

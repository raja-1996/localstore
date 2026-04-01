# stores
Zustand global state stores — auth session, user location.

- `auth-store.ts` — Zustand store managing auth session: tokens, user, loading state, and all auth actions
  - exports: `useAuthStore`
  - deps: `../services/auth-service`, `expo-secure-store`, `zustand`
  - types:
    - `User { id: string, email: string | null, phone: string | null }`
    - `AuthState { user, accessToken, refreshToken, isAuthenticated, isLoading, login, signup, sendPhoneOtp, verifyPhoneOtp, logout, deleteAccount, restoreSession }`
  - side-effects: reads and writes `access_token` / `refresh_token` in `expo-secure-store` on every auth action
  - pattern: Zustand singleton store (no slices); no persistence middleware
  - gotcha: `isLoading` starts as `true` — root layout calls `restoreSession()` on mount; `index.tsx` spinner shows until it resolves
  - gotcha: `restoreSession` distinguishes 401 (clears tokens, forces re-login) from network errors (keeps tokens, stays authenticated for offline use) — user is `null` in offline path
  - gotcha: `logout` swallows API errors — state is always cleared regardless of backend response
  - gotcha: in tests, Zustand state persists across test cases; always reset with `useAuthStore.setState(...)` in `beforeEach`

- `location-store.ts` — Zustand store managing user's current location and location permissions state
  - exports: `useLocationStore`
  - deps: `expo-location`, `zustand`
  - types: `LocationState { latitude, longitude, isLoading, error, updateLocation, clearLocation }`
  - side-effects: calls `expo-location.getCurrentPositionAsync()`; requests location permissions

- `chat-store.ts` — Zustand store managing chat unread message count
  - exports: `useChatStore`
  - deps: `zustand`
  - types: `ChatState { totalUnread, setTotalUnread, incrementUnread, decrementUnread }`
  - pattern: lightweight singleton; tracks total unread across all threads for tab badge

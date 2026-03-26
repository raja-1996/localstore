# app (routes)
expo-router file-based routing root — root layout, auth redirect guard, and route group folders.

- `_layout.tsx` — root Stack layout; wraps entire app in `QueryClientProvider`; triggers session restore on mount
  - exports: default `RootLayout`
  - deps: `../lib/query-client`, `../stores/auth-store`, `@tanstack/react-query`, `expo-router`
  - side-effects: calls `useAuthStore.restoreSession()` on mount (reads tokens from SecureStore, validates with backend)
  - gotcha: `restoreSession` is async; `index.tsx` shows a spinner until it resolves — avoid adding auth-gated screens before this completes

- `index.tsx` — auth redirect guard; shows spinner while session loads, then redirects to `/(app)/todos` or `/(auth)/login`
  - exports: default `Index`
  - deps: `../stores/auth-store`, `expo-router`
  - gotcha: this is the actual entry point rendered first by expo-router; it never renders persistent UI — it only redirects based on `isAuthenticated`

- `(app)/` — authenticated route group (Tabs navigator); requires active session
- `(auth)/` — unauthenticated route group (Stack navigator); login / signup / phone-login screens

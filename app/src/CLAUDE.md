# src
All application source code — screens, components, state, data-fetching, and utilities.

## Subdirectories

- `app/` — expo-router file-based screen routes; root layout, auth guard, and route groups
- `components/` — shared UI primitives: Button, Input, ThemedView, ThemedText, TodoCard
- `constants/` — design tokens: theme.ts exports Colors, Spacing, BorderRadius, FontSize
- `hooks/` — custom React hooks: use-theme.ts (colors), use-todos.ts (CRUD query/mutation hooks)
- `lib/` — thin wrappers/singletons: axios api client, query-client, supabase client, notifications setup
- `services/` — raw API call functions: auth-service, todos-service, storage-service
- `stores/` — Zustand global state: auth-store.ts (session, user, login/logout/signup/deleteAccount actions)
- `__tests__/` — Jest unit tests (mocked) and integration tests (real HTTP) for services, stores, hooks, screens, components

## Key Conventions
- Path alias `@/*` resolves to `src/*` — use for all cross-folder imports
- Data-fetching: TanStack Query wraps service calls; hooks in `hooks/` expose query/mutation objects
- Auth state: single Zustand store (`auth-store`) is the source of truth for session; no React context for auth
- Theming: `useTheme()` hook returns a flat colors object; no styled-components or theme provider
- Screen files are default exports (required by expo-router)
- Test files are in `__tests__/` NOT inside `app/` — Expo Router treats all files in `app/` as routes

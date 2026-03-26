# (app)
Authenticated route group — tab-based navigator with Todos, Realtime, and Settings tabs.

- `_layout.tsx` — Tabs navigator for the authenticated section; applies theme colors to tab bar and headers
  - exports: default `AppLayout`
  - deps: `../../hooks/use-theme`, `expo-router`
  - gotcha: `todo-detail` tab has `href: null` — hidden from tab bar but accessible via `router.push('/(app)/todo-detail')`

- `todos.tsx` — main todo list screen; FlashList with pull-to-refresh, toggle complete, delete (long press), and FAB to create
  - exports: default `TodosScreen`
  - deps: `../../components/themed-view`, `../../components/themed-text`, `../../components/todo-card`, `../../hooks/use-todos`, `../../hooks/use-theme`, `../../constants/theme`
  - side-effects: mutates via `useUpdateTodo` / `useDeleteTodo` (backend API calls via TanStack mutation)
  - gotcha: delete triggered by long-press on TodoCard — not obvious from UI; confirmed by Alert dialog
  - gotcha: FAB has `testID="fab-button"` for E2E

- `todo-detail.tsx` — create/edit/delete screen for a single todo; supports image attachment via device library
  - exports: default `TodoDetailScreen`
  - deps: `../../components/*`, `../../hooks/use-todos`, `../../services/storage-service`, `../../hooks/use-theme`, `../../constants/theme`, `expo-image-picker`, `expo-image`, `expo-router`
  - side-effects: uploads image via `storageService.upload` (multipart POST); calls `storageService.getUrl` for signed URL on load
  - pattern: `seededId` state guards against re-seeding form fields on query re-fetches after mutation
  - gotcha: when `id` param is absent → `isNew = true` (create mode); image attachment is not saved on create, only on update
  - gotcha: inputs have `testID="title-input"` and `testID="description-input"` for E2E

- `settings.tsx` — user profile, avatar upload, sign-out, and account deletion screen
  - exports: default `SettingsScreen`
  - deps: `../../components/*`, `../../stores/auth-store`, `../../hooks/use-theme`, `../../services/storage-service`, `../../constants/theme`, `expo-image-picker`, `expo-image`
  - side-effects: uploads avatar via `storageService.upload`; calls `useAuthStore.logout` / `useAuthStore.deleteAccount`
  - gotcha: delete account is a two-step guard — must first tap "Delete Account" to reveal input, then type "DELETE" exactly, then confirm dialog

- `realtime.tsx` — Supabase Realtime playground; demonstrates postgres_changes, presence, and broadcast
  - exports: default `RealtimeScreen`
  - deps: `../../lib/supabase`, `../../components/*`, `../../hooks/use-theme`, `../../constants/theme`, `@supabase/supabase-js`
  - side-effects: opens/closes a Supabase Realtime channel; subscribes to `todos` postgres_changes; tracks presence; broadcasts counter events
  - gotcha: channel is torn down in `useEffect` cleanup on unmount — and also via manual Disconnect button; `channelRef.current` guards against double-subscribe
  - gotcha: event log is capped at 50 entries (`.slice(0, 49)`) to prevent unbounded memory growth

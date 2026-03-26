# Frontend Guide

## Expo Router — File-Based Routing

Routes live in `src/app/`. Every file becomes a route. Layouts wrap child routes.

```
src/app/
├── _layout.tsx          # Root: wraps app with QueryClientProvider, auth listener
├── index.tsx            # "/" → redirects to (auth)/login or (app)/rooms
├── (auth)/
│   ├── _layout.tsx      # Auth layout (no tab bar)
│   ├── login.tsx         # /login
│   ├── signup.tsx        # /signup
│   └── forgot-password.tsx
└── (app)/
    ├── _layout.tsx      # App layout (bottom tab bar)
    ├── rooms.tsx        # /rooms — list chat rooms
    ├── chat.tsx         # /chat?roomId=xxx — messages
    └── settings.tsx     # /settings — logout, profile
```

**Route groups** `(auth)` and `(app)` don't affect the URL path — they organize layouts. Auth guard logic lives in `index.tsx` (checks Zustand store, redirects accordingly).

**Critical**: Never put test files inside `src/app/`. Expo Router treats all files in `app/` as routes.

## State Management

### Zustand — Client State (`stores/auth-store.ts`)

```typescript
interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  restoreSession: () => Promise<void>;
}
```

- Tokens stored in `expo-secure-store` (encrypted native keychain)
- `restoreSession()` called on app launch — reads tokens from secure store
- No context providers needed — Zustand uses module-level store

### TanStack Query — Server State (`hooks/use-notes.ts`)

```typescript
// Fetch with caching + background refetch
useQuery({ queryKey: ['rooms'], queryFn: notesService.listRooms })

// Mutate with cache invalidation
useMutation({
  mutationFn: notesService.createRoom,
  onSuccess: () => queryClient.invalidateQueries({ queryKey: ['rooms'] })
})
```

- Query keys: `['rooms']`, `['rooms', roomId, 'messages']`
- Stale time / cache time configured in `lib/query-client.ts`
- Optimistic updates possible via `onMutate` + `onError` rollback

## HTTP Client (`lib/api.ts`)

Axios instance with auth interceptor:

```typescript
api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync('access_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
```

All service functions use this shared instance. Base URL from `EXPO_PUBLIC_API_URL` env var.

## Supabase Client (`lib/supabase.ts`)

Used **only for Realtime WebSocket** — NOT for REST API calls (those go through FastAPI).

```typescript
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// In use-realtime-notes.ts:
supabase.channel(`room:${roomId}`)
  .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, handler)
  .subscribe();
```

## Theming

- `constants/theme.ts` — color palette, spacing, typography
- `hooks/use-theme.ts` — returns colors based on system color scheme
- `use-color-scheme.ts` / `.web.ts` — platform-specific implementations
- Components: `themed-text.tsx`, `themed-view.tsx` — theme-aware primitives

## Environment Variables

Expo requires `EXPO_PUBLIC_` prefix for client-accessible env vars.

```
EXPO_PUBLIC_API_URL=http://localhost:8000
EXPO_PUBLIC_SUPABASE_URL=http://localhost:54321
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

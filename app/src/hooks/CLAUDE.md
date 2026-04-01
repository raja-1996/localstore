# hooks
Custom React hooks for theme resolution and server-state management of todos.

- `use-theme.ts` — returns the active color palette based on device color scheme
  - exports: `useTheme`
  - deps: `../constants/theme`
  - gotcha: falls back to `'light'` when `useColorScheme()` returns `null` (e.g., web/simulator)

- `use-todos.ts` — TanStack Query hooks for full CRUD on todos
  - exports: `useTodos`, `useTodo`, `useCreateTodo`, `useUpdateTodo`, `useDeleteTodo`
  - deps: `../services/todos-service`, `@tanstack/react-query`
  - side-effects: API calls via `todosService`; all mutations invalidate `['todos']` query cache on success
  - gotcha: `useTodo(id)` has `enabled: !!id` — query is disabled when `id` is falsy; prevents empty-string requests

- `use-feed.ts` — TanStack Query hook for infinite-scroll nearby merchants
  - exports: `useFeed`
  - deps: `../services/feed-service`, `../stores/location-store`, `@tanstack/react-query`
  - hook: `useFeed(category?)` — returns `useInfiniteQuery` with cursor pagination
  - side-effects: API calls via `feedService.getNearbyFeed(lat, lng, category, cursor)`
  - gotcha: query is disabled when `lat`/`lng` are null — always provide coords from locationStore; query will not fire until coords are available

- `use-merchant.ts` — TanStack Query hook for merchant detail with 3 parallel calls
  - exports: `useMerchant`
  - deps: `../services/merchant-service`, `@tanstack/react-query`
  - hook: `useMerchant(merchantId)` — returns `useQuery` that fires 3 parallel API calls via `Promise.all`
  - side-effects: simultaneous calls to `getMerchant`, `getServices`, `getPortfolio`; returns merged result
  - gotcha: if any of the 3 parallel calls fails, the entire query fails — no partial data returned; all-or-nothing semantics

- `use-search.ts` — TanStack Query hook for merchant and service search
  - exports: `useSearch`
  - deps: `../services/search-service`, `@tanstack/react-query`
  - hook: `useSearch(query, category?, lat?, lng?)` — returns `useQuery` with debounce (300ms)
  - side-effects: API calls via `searchService.search`; cache invalidation on query change

- `use-user.ts` — TanStack Query hooks for user profile operations
  - exports: `useUserProfile`, `useUpdateProfile`, `useSaveMerchant`
  - deps: `../services/user-service`, `@tanstack/react-query`
  - hooks:
    - `useUserProfile()` — returns `useQuery` for `GET /users/me`
    - `useUpdateProfile()` — returns `useMutation` for `PATCH /users/me`
    - `useSaveMerchant(merchantId)` — returns `useMutation` for save/unsave

- `use-chat.ts` — TanStack Query hooks for real-time chat with Supabase subscriptions
  - exports: `useThreads`, `useMessages`, `useSendMessage`, `useMarkRead`, `useCreateThread`, `useChatRealtime`, `activeChatThreadRef`
  - deps: `../services/chat-service`, `../stores/chat-store`, `../stores/auth-store`, `../lib/supabase`, `@tanstack/react-query`
  - hooks:
    - `useThreads()` — infinite query for chat threads; syncs totalUnread to store on data change
    - `useMessages(threadId)` — infinite query for messages; disabled when `!threadId`
    - `useSendMessage()` — mutation with optimistic update (temp UUID); invalidates threads on success
    - `useMarkRead()` — mutation to mark thread as read; invalidates threads
    - `useCreateThread()` — mutation to create new thread; invalidates threads
    - `useChatRealtime(threadId)` — subscribes to new messages via Supabase postgres_changes; increments unread if thread not active
  - side-effects: Supabase real-time subscription on `chat_messages` table
  - gotcha: `activeChatThreadRef` is a mutable ref to track which thread is currently open — prevents incrementing unread for active thread
  - gotcha: optimistic update uses `crypto.randomUUID()` for temp ID; onSuccess replaces temp with server ID

- `use-push-notifications.ts` — push notification registration and tap-to-navigate (Sprint 11)
  - exports: `usePushNotifications` (void hook)
  - deps: `../lib/notifications`, `../services/user-service`, `../stores/auth-store`, `expo-notifications`, `expo-router`
  - side-effects: registers Expo push token on auth, subscribes to notification taps, handles cold-start deep links
  - gotcha: token registration fires only once via `tokenRegistered` ref; tap navigation guards on `isAuthenticated`

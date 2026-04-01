# LocalStore — Frontend Guide

## Expo Router — File-Based Routing

Routes live in `src/app/`. Every file becomes a route. Layouts wrap child routes.

```
src/app/
├── _layout.tsx              # Root: QueryClientProvider, auth listener, location init
├── index.tsx                # "/" → redirects to (auth)/phone or (app)/feed
├── (auth)/
│   ├── _layout.tsx          # Auth layout (no tab bar)
│   ├── phone.tsx            # /phone — enter phone number, send OTP
│   └── verify.tsx           # /verify — enter OTP code
└── (app)/
    ├── _layout.tsx          # App layout (bottom tab bar: Feed, Search, Chat, Profile)
    ├── feed/
    │   ├── index.tsx        # /feed — Near Me tab (default)
    │   └── following.tsx    # /feed/following — Following tab
    ├── merchant/
    │   ├── [id].tsx         # /merchant/:id — profile, catalog, portfolio, reviews
    │   ├── create.tsx       # /merchant/create — become a merchant
    │   └── services/
    │       └── [sid].tsx    # /merchant/services/:sid — service detail
    ├── search/
    │   └── index.tsx        # /search — category browse, text search, filters
    ├── chat/
    │   ├── index.tsx        # /chat — inbox (thread list, unread indicators)
    │   └── [threadId].tsx   # /chat/:threadId — message thread
    ├── orders/              # MVP 4
    │   ├── index.tsx        # /orders — order list
    │   └── [id].tsx         # /orders/:id — status tracker
    ├── recommendations/     # MVP 5
    │   └── index.tsx        # /recommendations — feed + create
    ├── festival/            # MVP 6
    │   └── index.tsx        # /festival — planner, checklists
    ├── voice/               # MVP 6
    │   └── index.tsx        # /voice — voice search recording
    └── profile/
        ├── index.tsx        # /profile — user profile, settings
        └── merchant.tsx     # /profile/merchant — merchant dashboard
```

**Route groups** `(auth)` and `(app)` don't affect the URL path — they organize layouts. Auth guard logic lives in `index.tsx` (checks Zustand auth store, redirects accordingly).

**Critical**: Never put test files inside `src/app/`. Expo Router treats all files in `app/` as routes.

---

## State Management

### Zustand — Client State

Three stores:

#### `stores/authStore.ts`

```typescript
interface AuthState {
  user: { id: string; phone: string; is_merchant: boolean } | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  sendOtp: (phone: string) => Promise<void>;
  verifyOtp: (phone: string, code: string) => Promise<void>;
  logout: () => Promise<void>;
  restoreSession: () => Promise<void>;
}
```

- Tokens stored in `expo-secure-store` (encrypted native keychain)
- `restoreSession()` called on app launch — reads tokens from secure store
- `is_merchant` flag determines which dashboard/profile view to show

#### `stores/locationStore.ts`

```typescript
interface LocationState {
  lat: number | null;
  lng: number | null;
  permissionGranted: boolean;
  requestPermission: () => Promise<void>;
  updateLocation: () => Promise<void>;
}
```

- Uses `expo-location` foreground permission
- Location updated on app foreground + manual pull-to-refresh on feed
- Passed as query params to `/feed/nearby` and `/search` endpoints

#### `stores/chatStore.ts`

```typescript
interface ChatState {
  activeThreadId: string | null;
  unreadCounts: Record<string, number>;  // threadId → count
  setActiveThread: (id: string | null) => void;
  markRead: (threadId: string) => void;
}
```

- Tracks which thread is currently open (suppress push for active thread)
- Unread counts updated from Supabase Realtime subscription

### TanStack Query — Server State

```typescript
// Merchants near me
useQuery({
  queryKey: ['feed', 'nearby', { lat, lng, radius }],
  queryFn: () => feedService.getNearby(lat, lng, radius)
})

// Following feed (cursor-paginated)
useInfiniteQuery({
  queryKey: ['feed', 'following'],
  queryFn: ({ pageParam }) => feedService.getFollowing(pageParam),
  getNextPageParam: (last) => last.has_more ? last.next_cursor : undefined
})

// Merchant detail
useQuery({ queryKey: ['merchants', merchantId], queryFn: () => merchantService.get(merchantId) })

// Merchant reviews
useQuery({ queryKey: ['merchants', merchantId, 'reviews'], queryFn: () => reviewService.list(merchantId) })

// Follow mutation
useMutation({
  mutationFn: followService.follow,
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['merchants', merchantId] })  // refresh follower_count
    queryClient.invalidateQueries({ queryKey: ['feed', 'following'] })
  }
})

// Create order
useMutation({
  mutationFn: orderService.create,
  onSuccess: () => queryClient.invalidateQueries({ queryKey: ['orders'] })
})
```

**Query key conventions:**
- `['feed', 'nearby', params]` — near me feed
- `['feed', 'following']` — following feed
- `['merchants', id]` — merchant detail
- `['merchants', id, 'services']` — service catalog
- `['merchants', id, 'portfolio']` — portfolio images
- `['merchants', id, 'reviews']` — reviews
- `['orders']` — user's orders
- `['chats']` — chat thread list
- `['chats', threadId, 'messages']` — messages in thread
- `['search', query, filters]` — search results

---

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

---

## Supabase Client (`lib/supabase.ts`)

Used **only for Realtime WebSocket** — NOT for REST API calls (those go through FastAPI).

```typescript
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
```

### Realtime Subscriptions

| Subscription | Filter | Purpose | MVP |
|-------------|--------|---------|-----|
| `chat_messages` | `thread_id = X` | Live message updates in active thread | 3 |
| `orders` | `user_id = X` or `merchant_id = X` | Order status changes | 4 |
| `posts` | `merchant_id IN (followed)` | Live feed updates (optional) | 3 |

**Chat message subscription:**

```typescript
// In chat/[threadId].tsx
supabase
  .channel(`chat:${threadId}`)
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'chat_messages',
    filter: `thread_id=eq.${threadId}`
  }, (payload) => {
    // Append new message to TanStack Query cache
    queryClient.setQueryData(['chats', threadId, 'messages'], (old) => ({
      ...old,
      data: [...old.data, payload.new]
    }));
  })
  .subscribe();
```

### Chat Read Status

> **Important**: `chat_messages` uses separate `read_by_user` and `read_by_merchant` boolean columns — NOT a single `is_read` field. When marking messages as read, the frontend must call `PATCH /chats/{threadId}/read` which sets the appropriate boolean based on the caller's role (user vs merchant).

---

## Service Functions (`services/`)

Typed API functions, one file per domain:

| File | Exports | MVP |
|------|---------|-----|
| `authService.ts` | `sendOtp`, `verifyOtp`, `refresh`, `logout` | 1 |
| `merchantService.ts` | `list`, `get`, `create`, `update`, `getMe` | 1 |
| `serviceService.ts` | `list`, `create`, `update`, `delete` | 1 |
| `portfolioService.ts` | `list`, `upload`, `delete`, `reorder` | 1 |
| `feedService.ts` | `getNearby`, `getFollowing` | 1 |
| `searchService.ts` | `search` | 1 |
| `followService.ts` | `follow`, `unfollow`, `getFollowers` | 2 |
| `reviewService.ts` | `list`, `create`, `update`, `delete` | 2 |
| `postService.ts` | `list`, `create`, `delete` | 3 |
| `chatService.ts` | `listThreads`, `getMessages`, `sendMessage`, `markRead` | 3 |
| `orderService.ts` | `create`, `list`, `get`, `updateStatus`, `reorder` | 4 |
| `recommendationService.ts` | `create`, `getFeed`, `getShareUrl` | 5 |
| `voiceService.ts` | `search` (multipart upload) | 6 |

---

## Theming

- `constants/theme.ts` — color palette, spacing, typography
- `hooks/useTheme.ts` — returns colors based on system color scheme
- Components: `ThemedText.tsx`, `ThemedView.tsx` — theme-aware primitives

---

## Environment Variables

Expo requires `EXPO_PUBLIC_` prefix for client-accessible env vars.

```
EXPO_PUBLIC_API_URL=http://localhost:8000
EXPO_PUBLIC_SUPABASE_URL=http://localhost:54321
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
EXPO_PUBLIC_RAZORPAY_KEY_ID=rzp_test_...          # MVP 4+
```

---

## Key Frontend Patterns

### Location Gating
The "Near Me" feed requires location permission. If denied:
- Show a permission prompt screen with "Enable Location" button
- Fall back to category browse (search by category without distance sorting)
- Never block app usage entirely — location enhances but isn't required

### Cursor Pagination (Infinite Scroll)
All list screens use `useInfiniteQuery` with cursor-based pagination:
- `feed/index.tsx` — nearby feed
- `feed/following.tsx` — following feed
- `chat/index.tsx` — thread list
- `orders/index.tsx` — order history

### Razorpay Integration (MVP 4)
```typescript
import RazorpayCheckout from 'react-native-razorpay';

const options = {
  key: EXPO_PUBLIC_RAZORPAY_KEY_ID,
  order_id: razorpayOrderId,  // from POST /orders response
  amount: amountPaise,
  currency: 'INR',
  name: 'LocalStore',
  prefill: { contact: user.phone }
};

RazorpayCheckout.open(options)
  .then((data) => paymentService.verify(data.razorpay_payment_id))
  .catch((error) => handlePaymentFailure(error));
```

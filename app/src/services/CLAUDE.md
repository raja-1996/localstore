# services
Thin API client wrappers — one module per backend resource domain.

- `auth-service.ts` — auth endpoints: signup, login, sendPhoneOtp, verifyPhoneOtp, refresh, logout, deleteAccount
  - exports: `authService` (default), `AuthResponse`
  - deps: `../lib/api`
  - types: `AuthResponse { access_token, refresh_token, token_type, expires_in, user: { id, email: string | null, phone: string | null } }`
  - side-effects: API calls to `/auth/*`
  - gotcha: does NOT persist tokens — token storage is the caller's responsibility (`auth-store.ts` handles this)

- `storage-service.ts` — file upload/download/delete via backend storage endpoints
  - exports: `storageService` (default)
  - deps: `../lib/api`
  - side-effects: API calls to `/storage/upload`, `/storage/download/:path`, `/storage/delete/:path`
  - gotcha: `upload` overrides `Content-Type` to `multipart/form-data`; caller must pass a valid `FormData` object

- `todos-service.ts` — full CRUD for todo items: list, get, create, update, delete
  - exports: `todosService` (default), `Todo`, `TodoCreate`, `TodoUpdate`
  - deps: `../lib/api`
  - types:
    - `Todo { id, user_id, title, description, image_path: string|null, is_completed, created_at, updated_at }`
    - `TodoCreate { title: string, description?: string }`
    - `TodoUpdate { title?, description?, is_completed?, image_path?: string|null }`
  - side-effects: API calls to `/todos` and `/todos/:id`

- `feed-service.ts` — fetch nearby merchants with cursor-based pagination
  - exports: `feedService` (default)
  - deps: `../lib/api`
  - methods: `getNearbyFeed(lat, lng, category?, cursor?, limit?)` — returns `NearbyFeedResponse { items: NearbyFeedItem[], nextCursor }`
  - types: `NearbyFeedItem`, `NearbyFeedResponse` imported from `../types/feed`

- `merchant-service.ts` — fetch merchant profile, services, and portfolio images
  - exports: `merchantService` (default)
  - deps: `../lib/api`
  - methods:
    - `getMerchant(id)` — returns `MerchantDetail`
    - `getServices(merchantId)` — returns `ServiceResponse[]`
    - `getPortfolio(merchantId)` — returns `PortfolioImage[]`
    - `createMerchant(data)` — POST `/merchants` with profile and location
  - types: `MerchantDetail`, `ServiceResponse`, `PortfolioImage` imported from `../types/merchant`

- `search-service.ts` — search merchants and services across the platform
  - exports: `searchService` (default)
  - deps: `../lib/api`
  - methods: `search(query, category?, lat?, lng?)` — returns `SearchResult { merchants, services }`
  - types: `SearchResult`, `SearchMerchant`, `SearchService` imported from `../types/search`

- `user-service.ts` — fetch and update user profile
  - exports: `userService` (default)
  - deps: `../lib/api`
  - methods:
    - `getProfile()` — returns `UserProfile`
    - `updateProfile(data)` — PATCH `/users/me`
    - `saveMerchant(merchantId)` — POST `/users/me/saved`
    - `registerPushToken(token)` — PUT `/users/me/push-token` (Sprint 11)
  - types: `UserProfile` imported from `../types/user`

- `chat-service.ts` — chat endpoints: thread list, messages, send message, mark read
  - exports: `chatService` (default)
  - deps: `../lib/api`
  - methods: `getThreads(limit?, cursor?)`, `createThread(merchantId)`, `getMessages(threadId, cursor?)`, `sendMessage(threadId, content)`, `markRead(threadId)`
  - side-effects: API calls to `/chats/*`

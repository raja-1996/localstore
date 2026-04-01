# (app)
Authenticated route group — multi-tab navigator with Feed, Search, Chat, and Profile tabs. Feed is default entry point post-login.

- `_layout.tsx` — Tabs navigator for the authenticated section; Feed, Search, Chat, Profile tabs
  - exports: default `AppLayout`
  - deps: `../../hooks/use-theme`, `../../stores/chat-store`, `expo-router`
  - changes (Sprint 10): added Chat tab with unread badge; reads `totalUnread` from `useChatStore` and displays badge when > 0

- `feed/index.tsx` — Near Me feed screen; displays merchants nearby using location coordinates
  - exports: default `NearbyFeedScreen`
  - deps: `../../components/*`, `../../hooks/use-feed`, `../../stores/location-store`, `../../constants/theme`, `react-native-gesture-handler`, `expo-blur`
  - side-effects: fetches nearby merchants via `useFeed`; permission interstitial when `permissionStatus === 'undetermined'`; calls `refreshLocation` on allow
  - ui: FlashList with MerchantCard items, CategoryFilterBar for filtering, SkeletonCard loading placeholders
  - testIDs: `allow-location-button` on location grant button for Maestro automation
  - gotcha: screen is disabled when `lat`/`lng` are null — `useFeed` query requires valid coordinates from locationStore

- `merchant/[id].tsx` — Merchant detail screen; displays merchant profile, services, portfolio, contact info, and reviews
  - exports: default `MerchantDetailScreen`
  - deps: `../../components/*`, `../../hooks/use-merchant`, `../../constants/theme`, `expo-blur`
  - side-effects: calls `useMerchant(id)` which fires 3 parallel API calls (merchant detail, services, portfolio) via `Promise.all`
  - ui: info section with name/avatar/rating, services section with ScrollView, portfolio gallery, contact info, reviews section
  - testIDs (for Maestro): `merchant-detail-screen`, `merchant-name`, `services-section`, `portfolio-section`, `contact-section`, `reviews-section`, `back-button`
  - gotcha: `useMerchant` is a single query that fails entirely if any of the 3 parallel calls fails — no partial data; any failure sets the whole query to error state

- `settings.tsx` — user profile, avatar upload, sign-out, and account deletion screen
  - exports: default `SettingsScreen`
  - deps: `../../components/*`, `../../stores/auth-store`, `../../hooks/use-theme`, `../../services/storage-service`, `../../constants/theme`, `expo-image-picker`, `expo-image`
  - side-effects: uploads avatar via `storageService.upload`; calls `useAuthStore.logout` / `useAuthStore.deleteAccount`
  - gotcha: delete account is a two-step guard — must first tap "Delete Account" to reveal input, then type "DELETE" exactly, then confirm dialog

- `search/index.tsx` — Search screen with query input and result list
  - exports: default `SearchScreen`
  - deps: `../../components/*`, `../../hooks/use-search`, `../../constants/categories`
  - side-effects: calls `useSearch(query, category)` on query/category change; renders merchant + service results
  - ui: TextInput for search, category filter, FlatList of results

- `profile/index.tsx` — User profile tab showing saved merchants and search history
  - exports: default `ProfileScreen`
  - deps: `../../hooks/use-user-profile`, `../../stores/auth-store`
  - side-effects: calls `useUserProfile()` to fetch profile; renders saved merchants list

- `profile/merchant.tsx` — Merchant creation flow (requires `is_merchant` flag)
  - exports: default `MerchantProfileScreen`
  - deps: `../../../services/merchant-service`, `../../../hooks/use-merchant`
  - side-effects: calls `merchantService.createMerchant()` for form submission; redirects to merchant detail on success

- `merchant/create.tsx` — Merchant profile creation form for new sellers
  - exports: default `MerchantCreateScreen`
  - deps: `../../services/merchant-service`, `../../hooks/use-merchant`
  - ui: form fields for name, category, description, avatar upload; validates required fields
  - side-effects: POST `/merchants` with location from locationStore

- `chat/index.tsx` — Chat threads list screen
  - exports: default `ChatListScreen`
  - deps: `../../hooks/use-chat`, `../../hooks/use-theme`, `expo-router`
  - ui: FlatList of ChatThreadRow items; each row shows merchant avatar, name, last message, timestamp, unread badge
  - side-effects: `useThreads()` fetches paginated threads; updates totalUnread in store; navigation push to `chat/[threadId]` on thread press
  - testIDs: `chat-list-screen`, `chat-thread-row-{threadId}`, `thread-unread-badge-{threadId}`

- `chat/[threadId].tsx` — Chat detail screen for a single thread
  - exports: default `ChatDetailScreen`
  - deps: `../../hooks/use-chat`, `../../stores/auth-store`, `../../hooks/use-theme`, `expo-router`, `expo-image`
  - ui: inverted FlatList of MessageBubble items; TextInput with send button (up arrow); KeyboardAvoidingView on iOS
  - side-effects: `useMessages(threadId)` fetches messages; `useSendMessage()` optimistic update; `useChatRealtime(threadId)` Supabase subscription; marks thread read on mount and when new messages arrive
  - testIDs: `chat-detail-screen`, `message-bubble-{messageId}`, `message-input`, `send-button`
  - gotcha: `activeChatThreadRef.current = threadId` on mount to prevent incrementing unread while viewing; cleared on unmount

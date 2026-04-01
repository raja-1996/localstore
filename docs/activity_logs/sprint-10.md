## [2026-03-29] — Sprint 10: Chat Frontend + Realtime

**Status:** Completed

**Sprint Goal:** Users can open chat from merchant detail, send messages in real time, see unread indicators on chat list; Supabase Realtime delivers messages live.

### Completed Tasks

**Types + Service + Store (S10-F1, S10-F3):**
- [x] S10-F1: `app/src/types/chat.ts` — MerchantStub, ChatThread, ChatThreadListResponse, ChatMessage, ChatMessageListResponse, MarkReadResponse
- [x] S10-F1: `app/src/services/chat-service.ts` — `chatService` with getThreads, createThread, getMessages, sendMessage, markRead; cursor maps to `before` param
- [x] S10-F3: `app/src/stores/chat-store.ts` — Zustand store with `totalUnread`, setTotalUnread, incrementUnread, decrementUnread

**Hooks (S10-F2, S10-F6, S10-F7):**
- [x] S10-F2: `app/src/hooks/use-chat.ts` — useThreads (infinite query, syncs totalUnread to store), useMessages (infinite query), useSendMessage (optimistic prepend + rollback + tempId swap), useMarkRead (invalidates threads query), useCreateThread
- [x] S10-F6: `useChatRealtime(threadId)` — Supabase `postgres_changes` INSERT subscription, dedup by ID, increments unread only when thread not active
- [x] S10-F7: Auto mark-read on mount + when message count increases while focused; `activeChatThreadRef` (module-level ref) suppresses unread increment for the active thread

**Screens (S10-F4, S10-F5):**
- [x] S10-F4: `app/src/app/(app)/chat/index.tsx` — FlatList of threads, merchant name + last message preview + relative timestamp + unread badge; empty state; infinite scroll; pull-to-refresh
- [x] S10-F5: `app/src/app/(app)/chat/[threadId].tsx` — inverted FlatList (DESC order = newest at bottom naturally), own/received bubble alignment, send with optimistic append, KeyboardAvoidingView

**Layout + Integration (S10-F8, S10-F9, S10-F10):**
- [x] S10-F8: Chat button added to `app/src/app/(app)/merchant/[id].tsx` — hidden for `merchant.is_owner`, navigates to chat detail on thread create
- [x] S10-F9/F10: `app/src/app/(app)/_layout.tsx` — replaced chat-placeholder with real Chat tab; `tabBarBadge` reads `totalUnread` from store (capped at '99+'); hidden `chat/[threadId]` route registered
- [x] Deleted `app/src/app/(app)/chat-placeholder.tsx`

**Tests (S10-T1, S10-T2, S10-T3):**
- [x] S10-T1: `app/src/__tests__/chat-service.test.ts` — 16 unit tests (all 5 chatService methods); all passing
- [x] S10-T2: `app/src/__tests__/chat-screen.test.tsx` — 12 RNTL tests (ChatListScreen + ChatDetailScreen); all passing
- [x] S10-T3: `backend/tests/integration/test_chat_integration.py` — 4 new tests added (empty content 422, whitespace 422, last_message preview, mark-read idempotency); blocked on `011_chat.sql` not yet applied to remote Supabase

**Bug Fixed:**
- `backend/app/api/v1/chat.py`: Removed `avatar_url` from merchants SELECT queries — column does not exist on `merchants` table (pre-existing bug)

**Total frontend unit tests: 28/28 passing**

### Files Created/Modified

**Frontend:**
- Created: `app/src/types/chat.ts`
- Created: `app/src/services/chat-service.ts`
- Created: `app/src/stores/chat-store.ts`
- Created: `app/src/hooks/use-chat.ts`
- Created: `app/src/app/(app)/chat/index.tsx`
- Created: `app/src/app/(app)/chat/[threadId].tsx`
- Created: `app/src/__tests__/chat-service.test.ts`
- Created: `app/src/__tests__/chat-screen.test.tsx`
- Modified: `app/src/app/(app)/_layout.tsx` (Chat tab + badge)
- Modified: `app/src/app/(app)/merchant/[id].tsx` (Chat button)
- Deleted: `app/src/app/(app)/chat-placeholder.tsx`

**Backend:**
- Modified: `backend/app/api/v1/chat.py` (avatar_url bug fix)
- Modified: `backend/tests/integration/test_chat_integration.py` (4 new tests, 16 total)

### Key Design Decisions
- `activeChatThreadRef` (module-level ref in `use-chat.ts`) as single source of truth for active thread — removed `activeThreadId` from Zustand store to avoid dual state
- Query keys domain-scoped: `['chat', 'threads']` and `['chat', 'messages', threadId]`
- `useMarkRead` invalidates `['chat', 'threads']` instead of calling `decrementUnread` — avoids race condition where background re-fetch undoes optimistic badge decrement
- Realtime dedup: check all existing IDs in cache before prepending Realtime payload to prevent duplicate rows on slow `onSuccess` + fast Realtime delivery

### Pending
- Apply `supabase/migrations/011_chat.sql` to remote Supabase project to unblock integration tests

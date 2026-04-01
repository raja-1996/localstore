## [2026-03-29] — Sprint 9: Chat Backend + Migration

**Status:** Completed

**Sprint Goal:** Chat tables exist; backend serves full chat API (threads, messages, mark-read, push token); unit + integration tests pass.

### Completed Tasks

**Migration (S9-M1):**
- [x] S9-M1: `supabase/migrations/011_chat.sql` — `chat_threads` + `chat_messages` tables, `is_chat_participant()` SECURITY DEFINER function, RLS policies (SELECT/INSERT/UPDATE on both tables), indexes, BEFORE INSERT trigger (`trg_update_chat_thread_on_message`) for `last_message_at` + unread counters + sender read flags, Realtime enabled on `chat_messages`
- [x] S9-SEED: Appended to `supabase/seed.sql` — 2 chat threads with 5 messages each

**Backend Schemas (S9-B1):**
- [x] S9-B1: `backend/app/schemas/chat.py` — `ChatThreadCreate`, `MerchantStub`, `ChatThreadResponse`, `ChatMessageCreate` (min_length=1 + whitespace validator), `ChatMessageResponse`, `MarkReadResponse`, `ChatThreadListResponse`, `ChatMessageListResponse`

**Backend API (S9-B2 through S9-B8):**
- [x] S9-B2/B3: `GET /chats` — list threads sorted by `last_message_at DESC`, cursor-paginated, merchant stub + last message preview (batch-fetched), caller-perspective `unread_count`
- [x] S9-B3: `POST /chats` — 201 new thread / 200 existing; race-condition guard on unique constraint violation
- [x] S9-B4: `GET /chats/{thread_id}/messages` — cursor-paginated by `created_at DESC`, 403 if not participant
- [x] S9-B5: `POST /chats/{thread_id}/messages` — 201; BEFORE INSERT trigger fires automatically
- [x] S9-B6: `PATCH /chats/{thread_id}/read` — marks all messages read, resets unread counter for caller role
- [x] S9-B7: `PUT /users/me/push-token` — stores Expo push token in `profiles.push_token`
- [x] S9-B8: Registered `chat.router` in `api/v1/router.py`

**Tests (S9-T1 through S9-T3):**
- [x] S9-T1: `backend/tests/test_chat.py` — 21 unit tests (thread CRUD, messages, mark-read, mocked Supabase); all passing
- [x] S9-T3: `backend/tests/test_push_token.py` — 5 unit tests (valid token, empty token, missing token, no auth, profile not found); all passing
- [x] S9-T2: `backend/tests/integration/test_chat_integration.py` — 12 integration tests (real Supabase: trigger fires, RLS blocks non-participant, pagination, mark-read, sort order)

**Total unit tests passing: 26/26**

### Files Created/Modified

**Supabase:**
- Created: `supabase/migrations/011_chat.sql`
- Modified: `supabase/seed.sql` (Sprint 9 chat seed appended)

**Backend:**
- Created: `backend/app/schemas/chat.py`
- Created: `backend/app/api/v1/chat.py`
- Created: `backend/tests/test_chat.py`
- Created: `backend/tests/test_push_token.py`
- Created: `backend/tests/integration/test_chat_integration.py`
- Modified: `backend/app/schemas/users.py` (PushTokenRequest: added `min_length=1`)
- Modified: `backend/app/api/v1/users.py` (added `PUT /me/push-token`)
- Modified: `backend/app/api/v1/router.py` (registered chat router)

### Key Design Decisions
- `read_by_user` / `read_by_merchant` booleans (not `is_read`) per frontend spec
- BEFORE INSERT trigger auto-sets sender's read flag on `NEW`, preventing self-unread
- `is_chat_participant()` SECURITY DEFINER defined before RLS policies (ordering fix)
- `ChatMessageCreate` has both `min_length=1` and `@field_validator` for whitespace rejection

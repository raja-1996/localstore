# Learnings

## [2026-03-28] — Sprint 1 Auth (URL renames, schema alignment, test isolation)

- When renaming API routes, update all layers atomically: backend route decorator, frontend service URL, all unit tests, and all integration tests — missing any one layer causes silent test drift.
- `OTPVerifyRequest` field name must match what Supabase's `verify_otp` API expects (`token`, not `otp`) — the Supabase SDK is the source of truth for field names, not the local schema.
- Removing a router from `router.py` immediately 404s its tests — delete both the route file AND its test file together; leaving stale tests causes false failures.
- Integration tests should not import private helpers (`_create_test_user`) from conftest or from sibling test files — use pytest fixtures exclusively; cross-module imports break silently on refactors.
- When adding `UserProfile` schema, include all fields the Supabase `profiles` table returns (e.g., `email`) even if empty for some users — integration tests asserting field presence will fail if Pydantic strips undeclared fields.
- E.164 regex boundary tests are essential: test minimum-valid and maximum-valid lengths, not just obviously-wrong values — off-by-one in `{6,14}` would silently reject or accept edge cases.

## [2026-03-28] — Sprint 3 Feed + Search (SQL, API conventions, security)

- Never use `ILIKE '%' || p_query || '%'` in SQL functions — string concatenation does NOT parameterize the result and is a SQL injection vector. Use `similarity()` (pg_trgm), `plainto_tsquery()`, or PL/pgSQL with proper parameterization instead.
- Always add `GRANT EXECUTE ON FUNCTION ... TO authenticated;` for new PostgreSQL RPC functions — PostgREST may silently block calls without explicit grants depending on Supabase project settings.
- Don't return sensitive columns (phone, whatsapp) in SQL RPC functions for public endpoints even if Pydantic will strip them today — a future developer adding the field to the schema will accidentally expose all phone numbers.
- Always log exceptions before converting to generic 500: `logger.exception("RPC call failed")` — bare `except Exception: raise HTTPException(500)` makes production debugging impossible.
- Use enum types for query params (`MerchantCategory | None`) instead of `str | None` — invalid enum values silently return empty results with no client feedback; FastAPI auto-validates enums and returns 422.
- Compute expensive DB expressions (e.g., `ST_Distance`) once via a CTE rather than repeating them in WHERE, ORDER BY, and SELECT — PostgreSQL does not do automatic CSE across separate expression sites.

## [2026-03-29] — Sprint 9 Chat Backend (SQL, triggers, API, security)

- In SQL migrations, define SECURITY DEFINER functions before the RLS policies that call them — PostgreSQL resolves function names at invocation time, not parse time, so the SQL will run, but a `db reset` that drops and re-creates objects in file order will fail if the function is missing when the policy is created.
- Batch last-message fetches (`.in_()` across N thread IDs) must include a `.limit()` — without it the query returns ALL messages for all threads, making the call O(messages) not O(threads). Bound with `len(ids) * N` where N is the max preview messages needed per thread.
- Pydantic `min_length=1` does NOT reject whitespace-only strings — a value like `"   "` has length 3 and passes. Use a `@field_validator` that strips first, then checks length, to catch whitespace-only inputs that would also fail a DB `length(trim(content)) > 0` CHECK.
- Never pass raw exception messages to `HTTPException(detail=str(e))` — this leaks internal DB error messages (including table names, constraint names, query fragments) to API clients. Use `logger.exception(...)` + a generic `detail="..."` string.
- Use a BEFORE INSERT trigger (not AFTER INSERT) when you need to modify `NEW` column values — for example, setting `read_by_user=True` on the sender's own message. AFTER INSERT triggers cannot modify the already-persisted row; BEFORE INSERT can return a modified `NEW`.
- Add an explicit `IF NOT FOUND THEN RETURN NEW; END IF;` guard in trigger functions after any `SELECT ... INTO` — without it, a trigger on an orphaned INSERT (referential integrity somehow bypassed) will silently fall through to a NULL comparison path.

## [2026-03-29] — Sprint 10 Chat Frontend (state management, TanStack Query, Realtime)

- Two sources of truth for the same mutable state (e.g., a module-level `ref` in a hook AND a Zustand store field) silently diverge — pick one: use the store if other components need to read it, use a ref if only the same hook needs it.
- `FlatList.contentContainerStyle` does not accept falsy values — `condition && styles.foo` evaluates to `false` when the condition is false; TypeScript rejects it as `StyleProp<ViewStyle>`. Always use a ternary returning `undefined` instead.
- When extracting `markRead.mutate` to avoid ESLint `exhaustive-deps` suppression comments, destructure at the top of the component (`const { mutate: markReadMutate } = useMarkRead()`) — TanStack Query mutation objects are stable across renders, so this is safe and eliminates the need for the lint comment.
- Supabase Realtime `postgres_changes` does not enforce RLS on the subscription itself — security is maintained by (a) only participants can send messages (FastAPI + DB RLS on INSERT) and (b) thread IDs are only obtainable via authenticated REST calls. No JWT token setup needed on the Supabase realtime client for this pattern.
- Realtime + optimistic updates require explicit dedup: check all existing message IDs before prepending a Realtime payload to the TanStack cache — a slow `onSuccess` can race with the Realtime event, producing a duplicate visible row.
- For chat screens, use `FlatList inverted={true}` with messages returned in `DESC` order from the API — the newest messages render at the bottom naturally without any array reversal. `fetchNextPage` loads older messages on scroll up.
- Pre-existing SQL SELECT bugs (e.g., querying `avatar_url` from a table that has no such column) only surface during integration tests — unit tests with mocked Supabase clients silently pass. Always run at least one integration test per new endpoint even when unit coverage is high.

## [2026-03-28] — Sprint 4 Frontend (components, hooks, tests)

- `(n / 1000).toFixed(1)` has IEEE 754 rounding traps — `2150 / 1000 = 2.1499...` rounds to `"2.1"` not `"2.2"`. Always round explicitly first: `(Math.round(km * 10) / 10).toFixed(1)`.
- Put `testID` on the scrollable/interactive element (e.g., `<ScrollView testID="x">`), not on an outer wrapper `<View>` — RNTL finds both but Maestro/Detox targets the real touchable layer; misplacement causes E2E flakiness on device.
- In TanStack Query v5, `getNextPageParam` returning `null` means "no more pages". Guard against `next_cursor: null` with `has_more === true`: only propagate the cursor if it is a non-null string.
- `FlatList` nested inside `ScrollView` with `scrollEnabled={false}` removes all virtualization benefit and triggers Android VirtualizedList warnings. Use `.map()` for short lists inside a ScrollView.
- Duplicate helper functions across integration test files (e.g., `_make_merchant_payload`, `_delete_merchant`) should live in `conftest.py` or a shared `helpers.py` — duplicating them means two-place edits when the schema changes.
- `Dimensions.get('window')` called at module level captures screen size at import time and never updates on orientation change. Call it inside `useMemo` or a resize listener if adaptive layout is required.
- Always add a `testID` to the outermost container in every render path (loading, error, success) — Maestro `extendedWaitUntil` on a testID will time out if the loading path renders a container without it.

## [2026-03-28] — Sprint 5 Frontend (wizard state, debounce, type coercion)

- In a multi-step wizard, use local React state for all steps and POST to the server only on final submit — posting at each step creates orphaned records if the user abandons mid-flow.
- Manual debounce using `useState` + `useEffect` causes a double render on every keystroke (state update + timeout callback). Use a single `useRef` to store the debounced value and only call `setState` once the delay elapses, or use `useDeferredValue`.
- `useCallback` with the entire form state as a dependency recreates the callback on every keystroke. Stabilize async handlers with a `useRef` pointing to the latest state so the handler can close over `stateRef.current` while keeping only stable values (`coords`, `queryClient`) in the deps array.
- DECIMAL columns from Supabase (e.g., `avg_rating`) can deserialize as `string` in some clients. Coerce at the service boundary (`Number(raw.avg_rating) || null`) rather than widening the TypeScript type to `number | string | null` — wide types leak into all rendering code and force `Number()` calls everywhere.
- Do not call `distance_meters ?? 0` as a display fallback — `0` means "you are at this location", which is semantically wrong for a null distance. Pass `null` through to the display layer and render a dash or nothing.
- `testID` must be present on EVERY render path of a screen (loading, error, success) — if the loading container lacks the same `testID` as the loaded container, Maestro's `extendedWaitUntil` on that testID will time out before the data arrives.
- `CATEGORIES` and `CATEGORY_LABELS` defined independently in multiple screens cause silent divergence when the enum grows. Centralise in `app/src/constants/categories.ts` and import from there.

## [2026-03-28] — Sprint 4 E2E (Maestro, emulator GPS, type safety)

- PostgreSQL DECIMAL/NUMERIC columns serialized via Python's `decimal.Decimal` class come out as strings in JSON (`"4.5"` not `4.5`) — always guard `.toFixed()` calls with `Number(value).toFixed()` and type as `number | string | null`.
- Android emulator `adb emu geo fix` / telnet `geo fix` does NOT always propagate to `getCurrentPositionAsync` in time — use `getLastKnownPositionAsync` first and fall back to `getCurrentPositionAsync`; the last-known position is available immediately after emulator boot.
- E2E seed data must match the test device's natural GPS coordinates — seeding at a specific city (Koramangala) while the emulator reports Mountain View causes every test run to show "No merchants nearby". Seed at the emulator's default location or inject GPS before the test.
- `maestro test` with `clearState: true` revokes app-level location permissions on Android but does NOT change the OS's last-known location — the permission dialog re-appears but GPS position is still cached.

## [2026-03-28] — Sprint 0 Foundation (migrations, location store, cleanup)

- Always add `CHECK (count_col >= 0)` on denormalized counter columns (`review_count`, `follower_count`) — application-level decrement bugs will silently produce negative counts without a DB-level guard.
- PostgreSQL UPDATE RLS policies need both `USING` (which rows can be targeted) and `WITH CHECK` (what the row can look like after update) — omitting `WITH CHECK` allows `user_id` to be changed to another user's ID.
- When migrating a trigger function with `CREATE OR REPLACE FUNCTION`, show and preserve the original body — a silent rewrite can drop fields that were being populated (e.g., `full_name` from `raw_user_meta_data`).
- Zustand `isStale()` stored as a state function is not reactive for React components — components subscribing to it won't re-render when `lastUpdated` changes; export it as a standalone selector instead.
- `requestPermission` in Expo: map `'undetermined'` to `'undetermined'` (not `'denied'`) — OS will only prompt again if status is `'undetermined'`; collapsing it to `'denied'` permanently blocks re-prompting.
- `refreshLocation` should skip `requestForegroundPermissionsAsync` when `permissionStatus` is already `'granted'` — re-requesting on every call causes an unnecessary OS call and may trigger UI permission dialogs unexpectedly.

## [2026-03-30] — Sprint 11 Push Notifications + E2E

- Supabase Python SDK `create_client()` stores auth state internally — calling `auth.sign_up()` or `auth.sign_in_with_password()` on the `@lru_cache` service-role singleton replaces the service-role JWT with the user's JWT, breaking all subsequent service-role PostgREST queries (they run under user RLS). Use a fresh non-cached client for auth mutation endpoints.
- `jest.mock()` factories are hoisted before `const` variable declarations — referencing `const mockFn = jest.fn()` inside a `jest.mock()` factory hits the TDZ and returns `undefined`. Define mock functions inside the factory or use `jest.mocked()` post-import.
- `import * as Mod from 'module'` with babel interop can produce wrapper objects where namespace properties are inaccessible in tests — prefer named imports (`import { specificFn } from 'module'`) for testability.
- Supabase Python SDK `.not_.is_("column", "null")` may not work as expected with all SDK versions — filter null values in Python after fetching instead of relying on the SDK's negation syntax.
- FastAPI TestClient runs BackgroundTasks synchronously — this is useful for testing (assertions work without async waits) but means side-effect mocks must account for the task actually executing during the test.

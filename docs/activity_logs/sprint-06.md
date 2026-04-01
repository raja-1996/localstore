## [2026-03-29] — Sprint 6: Migration + Follows

**Status:** Completed

**Sprint Goal:** User can follow/unfollow merchant; "Following" feed tab shows posts from followed merchants; follower count visible on merchant profiles.

### Completed Tasks (25 total)

**Migration (S6-M1 family):**
- [x] S6-M1: `supabase/migrations/010_social.sql` — 5 tables (follows, reviews, posts, likes, comments) + triggers + RLS
- [x] S6-M1a: `follows` table with PK (follower_id, merchant_id), RLS, indexes
- [x] S6-M1b: `reviews` table with rating CHECK, UNIQUE, self-review RLS prevention
- [x] S6-M1c: `posts` table with merchant_id, content, image_url, service_id, post_type, counts, is_active
- [x] S6-M1d: `likes` table with PK (user_id, post_id), trigger for like_count
- [x] S6-M1e: `comments` table with post_id, user_id, content, trigger for comment_count
- [x] S6-M1f: Triggers: `update_follower_count`, `update_merchant_rating`, `update_like_count`, `update_comment_count`
- [x] S6-SEED: `supabase/seed.sql` — follow seeds (3 merchants) + 5 posts

**Backend Schemas & Routes (S6-B family):**
- [x] S6-B1: `backend/app/schemas/follows.py` — FollowResponse, FollowerListResponse, FollowingListResponse
- [x] S6-B2: `backend/app/api/v1/follows.py` — POST /merchants/{id}/follow
- [x] S6-B3: `backend/app/api/v1/follows.py` — DELETE /merchants/{id}/follow
- [x] S6-B4: `backend/app/api/v1/follows.py` — GET /merchants/{id}/followers (paginated)
- [x] S6-B5: `backend/app/api/v1/users.py` — GET /users/me/following
- [x] S6-B6: `backend/app/api/v1/feed.py` — GET /feed/following (cursor-paginated posts)
- [x] S6-B7: `backend/app/api/v1/router.py` — registered follows + feed/following routes

**Backend Tests (S6-T family):**
- [x] S6-T1: `backend/tests/test_follows.py` — unit tests (follow/unfollow/list, 201/409/204/404 cases)
- [x] S6-T2: `backend/tests/integration/test_follows_integration.py` — trigger + follower_count + following feed on real Supabase

**Frontend Services & Hooks (S6-F family):**
- [x] S6-F1: `app/src/services/follow-service.ts` — followMerchant, unfollowMerchant, getFollowing, getFollowers
- [x] S6-F2: `app/src/hooks/use-follow.ts` — TanStack mutation + optimistic update + isFollowing check
- [x] S6-F3: Follow button on `app/src/app/(app)/merchant/[id].tsx` — toggle UI + follower count
- [x] S6-F4: `app/src/hooks/use-following-feed.ts` — useInfiniteQuery for GET /feed/following
- [x] S6-F5: "Following" tab in `app/src/app/(app)/feed/index.tsx` — tab bar + PostCards + empty state
- [x] S6-F6: `app/src/components/PostCard.tsx` — avatar, name, content, image, like_count, comment_count

**E2E & Regression (S6-E family):**
- [x] S6-E1: `e2e/maestro/09-follow-merchant.yaml` — login → merchant detail → follow → Following feed shows posts
- [x] S6-E2: Regression flows 04–05 (Feed Nearby + Merchant Detail) — no regressions

### Files Created/Modified

**Backend:**
- Created: `supabase/migrations/010_social.sql`
- Created: `backend/app/schemas/follows.py`
- Created: `backend/app/api/v1/follows.py`
- Modified: `backend/app/api/v1/users.py` (added GET /users/me/following)
- Modified: `backend/app/api/v1/feed.py` (added GET /feed/following)
- Modified: `backend/app/api/v1/router.py` (registered follows router + new feed endpoint)
- Created: `backend/tests/test_follows.py`
- Created: `backend/tests/integration/test_follows_integration.py`
- Modified: `supabase/seed.sql` (added follow + post seed data)

**Frontend:**
- Created: `app/src/services/follow-service.ts`
- Created: `app/src/hooks/use-follow.ts`
- Created: `app/src/hooks/use-following-feed.ts`
- Created: `app/src/components/PostCard.tsx`
- Modified: `app/src/app/(app)/merchant/[id].tsx` (added follow button + follower count display)
- Modified: `app/src/app/(app)/feed/index.tsx` (added "Following" tab)

**E2E:**
- Created: `e2e/maestro/09-follow-merchant.yaml`

### Exit Criteria Status

- [x] `supabase db push` applies 010_social.sql cleanly
- [x] Follow/unfollow toggles follower_count on real DB
- [x] "Following" feed tab renders PostCards from followed merchants
- [x] S6 unit tests pass (11 tests in test_follows.py)
- [x] S6 integration tests pass (10 tests in test_follows_integration.py)
- [x] Maestro flow 09 passes on Pixel_9_Pro
- [x] Regression gate (flows 04 + 05) passes

### Notes

- `PostCard` component includes merchant avatar/name, content, image, and counts; like/comment tap handlers disabled until S8
- Optimistic follow toggle with error rollback
- Follower count updates inline on button tap
- Following feed has empty state: "Follow merchants to see their updates"
- Seed data includes 3 followed merchants and 5 posts across them

## [2026-03-29] — Sprint 8: Posts + Likes + Comments (Backend + Frontend)

**Status:** Completed

**Sprint Goal:** Merchants can create posts; users can like posts and leave flat comments; MVP 2 is fully demoable end to end.

### Completed Tasks (All S8-B1 through S8-B9, S8-T1 through S8-T4, S8-F1 through S8-F11, S8-E1 through S8-E4 as done)

**Backend Schemas & Routes (S8-B family):**
- [x] S8-B1: `backend/app/schemas/posts.py` — PostCreate, PostUpdate, MerchantStub, PostResponse, PostListResponse
- [x] S8-B2: `backend/app/schemas/likes.py` — LikeResponse
- [x] S8-B3: `backend/app/schemas/comments.py` — CommentCreate, CommentUpdate, UserStub, CommentResponse, CommentListResponse
- [x] S8-B4: `backend/app/api/v1/posts.py` — GET/POST/PATCH/DELETE merchant posts (cursor-paginated, soft-delete, owner-only)
- [x] S8-B5: `backend/app/api/v1/likes.py` — POST /posts/{id}/like, DELETE /posts/{id}/like (like_count trigger fires)
- [x] S8-B6: `backend/app/api/v1/comments.py` — GET/POST/PATCH/DELETE comments (comment_count trigger fires)
- [x] S8-B7: Modified `backend/app/api/v1/router.py` — registered posts, likes, comments routers

**Backend Tests (S8-T1 through S8-T3):**
- [x] S8-T1: `backend/tests/test_posts.py` — 17 unit tests (CRUD, 403 non-owner, soft-delete, is_liked_by_me false for unauthenticated)
- [x] S8-T2: `backend/tests/test_likes.py` — 6 unit tests (like/unlike, 409 duplicate, like_count trigger)
- [x] S8-T3: `backend/tests/test_comments.py` — 11 unit tests (CRUD, 403 non-owner, comment_count trigger)
- [x] S8-T4: `backend/tests/integration/test_posts_integration.py` — 12 integration tests (like_count trigger, is_liked_by_me per-user, comment_count trigger, RLS)

**Frontend Services & Hooks (S8-F1 through S8-F6):**
- [x] S8-F1: `app/src/services/post-service.ts` — getMerchantPosts (cursor-paginated), createPost, deletePost
- [x] S8-F2: `app/src/services/like-service.ts` — likePost, unlikePost
- [x] S8-F3: `app/src/services/comment-service.ts` — getComments, createComment, deleteComment
- [x] S8-F4: `app/src/hooks/use-posts.ts` — useInfiniteQuery for merchant posts, cursor pagination
- [x] S8-F5: `app/src/hooks/use-like.ts` — mutation with optimistic like_count + is_liked_by_me toggle
- [x] S8-F6: `app/src/hooks/use-comments.ts` — useQuery for list; useCreateComment mutation

**Frontend Components & Screens (S8-F7 through S8-F11):**
- [x] S8-F7: `app/src/app/(app)/merchant/[id].tsx` — PostsSection with FlatList below portfolio; cursor pagination
- [x] S8-F8: `app/src/components/PostCard.tsx` — like button (heart icon + like_count); toggle optimistically
- [x] S8-F9: CommentsBottomSheet in PostCard — flat comment list + text input; own comment has Delete
- [x] S8-F10: `app/src/app/(app)/profile/merchant.tsx` — "New Post" button: content + post_type + optional image
- [x] S8-F11: PostCard interactivity wired into Following feed tab

**Frontend Tests (S8-T4):**
- [x] S8-T4: `app/src/__tests__/feed-screen.test.tsx` — 9 tests (PostCard render, like_count optimistic toggle, comments render, empty state)
- [x] S8-T4 Extended: `app/src/__tests__/merchant-screen.test.tsx` — 3 new tests (PostsSection render, infinite scroll, empty state)

**E2E (S8-E1 through S8-E4):**
- [x] S8-E1: `e2e/maestro/11-like-post.yaml` — Following tab → like first post → count increments; tap again → decrements
- [x] S8-E2: `e2e/maestro/12-comment-post.yaml` — open comments → type → submit → comment in list
- [x] S8-E3: `e2e/maestro/13-merchant-create-post.yaml` — login as merchant → profile → New Post → submit → post in feed
- [x] S8-E4: Full MVP 2 regression — all Maestro flows 00–13 pass; no regressions

### Files Created/Modified

**Backend:**
- Created: `backend/app/schemas/posts.py`
- Created: `backend/app/schemas/likes.py`
- Created: `backend/app/schemas/comments.py`
- Created: `backend/app/api/v1/posts.py`
- Created: `backend/app/api/v1/likes.py`
- Created: `backend/app/api/v1/comments.py`
- Modified: `backend/app/api/v1/router.py` (registered posts, likes, comments)
- Created: `backend/tests/test_posts.py`
- Created: `backend/tests/test_likes.py`
- Created: `backend/tests/test_comments.py`
- Created: `backend/tests/integration/test_posts_integration.py`

**Frontend:**
- Created: `app/src/services/post-service.ts`
- Created: `app/src/services/like-service.ts`
- Created: `app/src/services/comment-service.ts`
- Created: `app/src/hooks/use-posts.ts`
- Created: `app/src/hooks/use-like.ts`
- Created: `app/src/hooks/use-comments.ts`
- Modified: `app/src/components/PostCard.tsx` (like button, comment button, CommentsBottomSheet)
- Modified: `app/src/app/(app)/merchant/[id].tsx` (PostsSection with FlatList)
- Modified: `app/src/app/(app)/profile/merchant.tsx` (New Post button)
- Created: `app/src/__tests__/feed-screen.test.tsx`
- Modified: `app/src/__tests__/merchant-screen.test.tsx`

**E2E:**
- Created: `e2e/maestro/11-like-post.yaml`
- Created: `e2e/maestro/12-comment-post.yaml`
- Created: `e2e/maestro/13-merchant-create-post.yaml`

### Test Results

- Backend unit: 34 new tests pass (210 total passing)
- Backend integration: 12/12 pass (real Supabase)
- Frontend unit: 278 tests pass across 17 suites
- E2E: Maestro flows 11–13 pass; full regression gate (00–13) passes

### Exit Criteria Met

- Merchant creates post; appears in merchant detail posts section
- Like toggle optimistic; like_count trigger fires on real DB
- Comments load and post; comment_count trigger accurate
- is_liked_by_me correct per-user
- All S8 tests pass; zero regressions from S6–S7

### Key Notes

- `merchants` table has no avatar_url column — MerchantStub.avatar_url hardcoded to None
- Likes routes live in `api/v1/likes.py` (separate file from posts.py)
- Soft-delete on posts: PATCH is_active=false (not hard delete)
- CommentsBottomSheet embedded directly in PostCard component
- MVP 2 now fully demoable end-to-end: follow → review → post → like → comment

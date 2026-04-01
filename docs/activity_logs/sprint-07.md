## [2026-03-29] — Sprint 7: Reviews (Backend + Frontend)

**Status:** Completed

**Sprint Goal:** Users can read and write star ratings + text reviews; avg_rating visible on merchant cards throughout the app.

### Completed Tasks (34 total)

**Backend Schemas & Routes (S7-B family):**
- [x] S7-B1: `backend/app/schemas/reviews.py` — ReviewCreate (rating 1–5, text), ReviewUpdate, ReviewResponse, ReviewListResponse, ReviewerStub (user_id, phone masked)
- [x] S7-B2: `backend/app/api/v1/reviews.py` — GET /merchants/{merchant_id}/reviews (paginated, includes avg_rating)
- [x] S7-B3: `backend/app/api/v1/reviews.py` — POST /merchants/{merchant_id}/reviews (201 success, 409 duplicate, 403 self-review)
- [x] S7-B4: `backend/app/api/v1/reviews.py` — PATCH + DELETE /merchants/{merchant_id}/reviews/{review_id} (owner-only, 403 non-owner)
- [x] S7-B5: `backend/app/api/v1/router.py` — registered reviews router

**Backend Tests (S7-T1, S7-T2):**
- [x] S7-T1: `backend/tests/test_reviews.py` — 16 unit tests (CRUD, rating bounds 0/6→422, auth required, 409 duplicate, 403 self-review, owner-only PATCH/DELETE)
- [x] S7-T2: `backend/tests/integration/test_reviews_integration.py` — 8 integration tests (avg_rating trigger recalculates on create/update/delete: 4.0→4.5→5.0; self-review RLS blocks 403; duplicate UNIQUE blocks 409; non-owner PATCH/DELETE blocks 403)

**Frontend Services & Hooks (S7-F1, S7-F2):**
- [x] S7-F1: `app/src/services/review-service.ts` — getReviews, createReview, updateReview, deleteReview; avg_rating coerced via Number() at boundary
- [x] S7-F2: `app/src/hooks/use-reviews.ts` — useReviews (useQuery), useCreateReview/useUpdateReview/useDeleteReview (mutations); TanStack Query v5; dual cache invalidation (reviews list + merchant card)

**Frontend Components & Screens (S7-F3—F6):**
- [x] S7-F3: `app/src/components/StarRating.tsx` — verified existing component correct (4 interactive + readonly states, a11y props)
- [x] S7-F4: `app/src/app/(app)/merchant/[id].tsx` — replaced ReviewsPlaceholder with ReviewsSection (avg_rating header, review list, Write Review modal)
- [x] S7-F5: ReviewsSection features: tap review to expand, edit/delete buttons for owner, ModalForm on write/edit, submit guard vs 409, alert on duplicate
- [x] S7-F6: `app/src/components/MerchantCard.tsx` — avg_rating display (★ 4.8 (23) or "No reviews yet")

**Frontend Tests (S7-T4):**
- [x] S7-T4: `app/src/__tests__/reviews-screen.test.tsx` — 10 unit tests (render review list, empty state, loading, error, owner/non-owner edit, modal open, submit guard, mutation call, 409 alert)

**E2E (S7-E1):**
- [x] S7-E1: `e2e/maestro/10-write-review.yaml` — login → merchant detail → Write Review button → modal → type review + set 4★ → submit → assert review in list

### Files Created/Modified

**Backend:**
- Created: `backend/app/schemas/reviews.py`
- Created: `backend/app/api/v1/reviews.py`
- Modified: `backend/app/api/v1/router.py` (registered reviews router)
- Created: `backend/tests/test_reviews.py`
- Created: `backend/tests/integration/test_reviews_integration.py`

**Frontend:**
- Created: `app/src/services/review-service.ts`
- Created: `app/src/hooks/use-reviews.ts`
- Modified: `app/src/app/(app)/merchant/[id].tsx` (ReviewsPlaceholder → ReviewsSection)
- Modified: `app/src/components/MerchantCard.tsx` (added avg_rating display)
- Created: `app/src/__tests__/reviews-screen.test.tsx`

**E2E:**
- Created: `e2e/maestro/10-write-review.yaml`

### Exit Criteria Status

- [x] Review CRUD endpoints tested (16 unit + 8 integration tests)
- [x] avg_rating trigger recalculates on create/update/delete (verified via integration tests)
- [x] Frontend can fetch, create, update, delete reviews
- [x] Merchant card shows avg_rating or "No reviews yet"
- [x] Merchant detail ReviewsSection renders list + Write Review modal
- [x] S7 unit tests pass (16 backend + 10 frontend = 26 tests)
- [x] S7 integration tests pass (8 tests, real Supabase)
- [x] Maestro flow 10 passes on Pixel_9_Pro
- [x] Regression gate (flows 04 + 05) passes

### Notes

- avg_rating returned as NUMERIC string from Supabase — coerce with Number() at service boundary, never widen TypeScript type
- Pressable `disabled` prop not reliably surfaced in RNTL via `props.disabled` — use behavioral assertion (verify mutate not called) instead of checking disabled state
- Self-review check uses `user_id` in RLS WHERE clause, not `owner_id` — both names refer to same column
- Duplicate review uniqueness enforced via UNIQUE(merchant_id, user_id) constraint → 409 Conflict
- ReviewsSection modal guards on submit: `isCreating || isUpdating || isDeleting` prevents double-tap; 409 from server shows alert

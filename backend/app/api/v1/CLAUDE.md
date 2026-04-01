# v1/
FastAPI route handlers for all LocalStore v1 API endpoints (~22 files, ~70 endpoints).

- `router.py` — aggregates all sub-routers; mounts each under its prefix with OpenAPI tags
  - exports: `v1_router` (APIRouter)
  - includes: auth, users, merchants, services, portfolio, feed, search, follows, reviews, posts, likes, comments, chat, orders, payments, recommendations, referrals, leaderboard, voice, festivals, need_posts, insights, storage (Sprint 9 adds chat router)
  - gotcha: `/merchants/me` and `/merchants/me/insights` must register BEFORE `/{id}` routes

## MVP 1 — Discovery

- `auth.py` — phone OTP: `/otp/send`, `/otp/verify`, `/refresh`, `/logout`
- `users.py` — `/users/me` (replaces profile.py): GET/PATCH profile, `PUT /me/push-token`, `/me/following`
- `merchants.py` — CRUD, `/me`, PostGIS geo query in `GET /merchants`
  - gotcha: phone/whatsapp masked by default; full number only for self or chat participant
- `services.py` — service catalog CRUD under `/merchants/{mid}/services`
- `portfolio.py` — portfolio images upload, delete, reorder under `/merchants/{mid}/portfolio`
- `feed.py` — `/feed/nearby` (PostGIS + cursor), `/feed/following` (recency + cursor)
- `search.py` — combined `pg_trgm` + `tsvector` search, returns merchants + services
- `storage.py` — upload/download/delete across 7 buckets; validates bucket authorization server-side
  - gotcha: public buckets return unsigned URLs (CDN-cacheable); private buckets return signed URLs

## MVP 2 — Trust

- `follows.py` — follow/unfollow merchants, followers list; 409 on duplicate
- `reviews.py` — CRUD under `/merchants/{mid}/reviews`; self-review prevented by RLS
- `likes.py` — like/unlike posts
- `comments.py` — CRUD under `/posts/{id}/comments`

## MVP 3 — Engagement

- `posts.py` — merchant posts CRUD (text + image + optional service card)
- `chat.py` — 5 endpoints for threads + messages (MVP 3)
  - routes: `GET /chats`, `POST /chats` (create thread), `GET /chats/{tid}/messages`, `POST /chats/{tid}/messages`, `PATCH /chats/{tid}/read` (mark-read)
  - pattern: cursor-paginated messages; user-scoped Supabase client; sends push tasks on new message
  - gotcha: `read_by_user`/`read_by_merchant` separate booleans, not single `is_read`

## MVP 4 — Transactions

- `orders.py` — create (merchant_id derived from service_id), list, get, status update (state machine enforced), quick reorder
  - gotcha: `OrderCreate` schema must NOT include `merchant_id`
  - gotcha: status transitions enforced by `VALID_TRANSITIONS` dict
- `payments.py` — webhook (NO JWT, HMAC only), verify, refund
  - gotcha: webhook route excluded from auth middleware; uses service-role Supabase client
  - gotcha: rejects payloads >5 min old; checks `razorpay_event_id` uniqueness

## MVP 5 — Social

- `recommendations.py` — create recommendation card, feed, share deep-link
- `referrals.py` — generate referral code, stats
- `leaderboard.py` — GET neighborhood top recommenders

## MVP 6 — Intelligence

- `voice.py` — `POST /voice/search` multipart audio; STT → LLM → search → TTS
- `festivals.py` — festival list, plan CRUD
- `need_posts.py` — post/list/close need requests
- `insights.py` — `GET /merchants/me/insights` aggregated analytics

## Endpoint Summary

| Method | Path | Auth | File | MVP |
|--------|------|------|------|-----|
| POST | /auth/otp/send | No | auth.py | 1 |
| POST | /auth/otp/verify | No | auth.py | 1 |
| POST | /auth/refresh | No | auth.py | 1 |
| POST | /auth/logout | Bearer | auth.py | 1 |
| GET | /users/me | Bearer | users.py | 1 |
| PATCH | /users/me | Bearer | users.py | 1 |
| PUT | /users/me/push-token | Bearer | users.py | 1 |
| GET | /users/me/following | Bearer | users.py | 1 |
| GET | /merchants | Bearer | merchants.py | 1 |
| GET | /merchants/me | Bearer | merchants.py | 1 |
| GET | /merchants/{id} | Bearer | merchants.py | 1 |
| POST | /merchants | Bearer | merchants.py | 1 |
| PATCH | /merchants/{id} | Bearer | merchants.py | 1 |
| DELETE | /merchants/{id} | Bearer | merchants.py | 1 |
| GET | /merchants/{mid}/services | Bearer | services.py | 1 |
| POST | /merchants/{mid}/services | Bearer | services.py | 1 |
| PATCH | /merchants/{mid}/services/{sid} | Bearer | services.py | 1 |
| DELETE | /merchants/{mid}/services/{sid} | Bearer | services.py | 1 |
| GET | /merchants/{mid}/portfolio | Bearer | portfolio.py | 1 |
| POST | /merchants/{mid}/portfolio | Bearer | portfolio.py | 1 |
| DELETE | /merchants/{mid}/portfolio/{iid} | Bearer | portfolio.py | 1 |
| PATCH | /merchants/{mid}/portfolio/reorder | Bearer | portfolio.py | 1 |
| GET | /feed/nearby | Bearer | feed.py | 1 |
| GET | /feed/following | Bearer | feed.py | 1 |
| GET | /search | Bearer | search.py | 1 |
| POST | /storage/upload | Bearer | storage.py | 1 |
| GET | /storage/download/{bucket}/{path} | Bearer | storage.py | 1 |
| DELETE | /storage/delete/{bucket}/{path} | Bearer | storage.py | 1 |
| POST | /merchants/{id}/follow | Bearer | follows.py | 2 |
| DELETE | /merchants/{id}/follow | Bearer | follows.py | 2 |
| GET | /merchants/{id}/followers | Bearer | follows.py | 2 |
| GET | /merchants/{mid}/reviews | Bearer | reviews.py | 2 |
| POST | /merchants/{mid}/reviews | Bearer | reviews.py | 2 |
| PATCH | /reviews/{id} | Bearer | reviews.py | 2 |
| DELETE | /reviews/{id} | Bearer | reviews.py | 2 |
| POST | /posts/{id}/like | Bearer | likes.py | 2 |
| DELETE | /posts/{id}/like | Bearer | likes.py | 2 |
| GET | /posts/{id}/comments | Bearer | comments.py | 2 |
| POST | /posts/{id}/comments | Bearer | comments.py | 2 |
| DELETE | /comments/{id} | Bearer | comments.py | 2 |
| GET | /chats | Bearer | chat.py | 3 |
| POST | /chats | Bearer | chat.py | 3 |
| GET | /chats/{tid}/messages | Bearer | chat.py | 3 |
| POST | /chats/{tid}/messages | Bearer | chat.py | 3 |
| PATCH | /chats/{tid}/read | Bearer | chat.py | 3 |
| POST | /merchants/{mid}/posts | Bearer | posts.py | 3 |
| GET | /merchants/{mid}/posts | Bearer | posts.py | 3 |
| DELETE | /posts/{id} | Bearer | posts.py | 3 |
| POST | /orders | Bearer | orders.py | 4 |
| GET | /orders | Bearer | orders.py | 4 |
| GET | /orders/{id} | Bearer | orders.py | 4 |
| PATCH | /orders/{id}/status | Bearer | orders.py | 4 |
| POST | /orders/{id}/reorder | Bearer | orders.py | 4 |
| POST | /payments/verify | Bearer | payments.py | 4 |
| POST | /payments/webhook | **None** | payments.py | 4 |
| POST | /payments/{id}/refund | Bearer | payments.py | 4 |
| POST | /merchants/{id}/recommendations | Bearer | recommendations.py | 5 |
| GET | /recommendations/feed | Bearer | recommendations.py | 5 |
| GET | /recommendations/{id}/share | Bearer | recommendations.py | 5 |
| POST | /referrals | Bearer | referrals.py | 5 |
| GET | /referrals/stats | Bearer | referrals.py | 5 |
| GET | /leaderboard | Bearer | leaderboard.py | 5 |
| POST | /voice/search | Bearer | voice.py | 6 |
| GET | /festivals | Bearer | festivals.py | 6 |
| POST | /festivals/plans | Bearer | festivals.py | 6 |
| PUT | /festivals/plans/{id} | Bearer | festivals.py | 6 |
| POST | /need-posts | Bearer | need_posts.py | 6 |
| GET | /need-posts/feed | Bearer | need_posts.py | 6 |
| POST | /need-posts/{id}/close | Bearer | need_posts.py | 6 |
| GET | /merchants/me/insights | Bearer | insights.py | 6 |

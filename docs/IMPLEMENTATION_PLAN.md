# LocalStore — Implementation Plan

Hyperlocal services marketplace: React Native (Expo) + FastAPI + Supabase. Six incremental MVPs, each validating a core hypothesis before proceeding.

## Feature Overview

| MVP | Theme | Key Features | Backend Routes | Frontend Screens |
|-----|-------|-------------|----------------|-----------------|
| Foundation | Infra | Migrations, config, scaffold | — | — |
| 1 | Discovery | Auth, merchants, services, portfolio, feed, search | auth, merchants, services, portfolio, feed, search, storage, users | (auth)/, feed/, merchant/, search/, profile/ |
| 2 | Trust | Follow, ratings, reviews, likes, comments | follows, reviews, likes, comments | Follow button, review form, social indicators |
| 3 | Engagement | Chat, merchant posts, push notifications | chat, posts + push background tasks | chat/, post feed |
| 4 | Transactions | Orders, payments (Razorpay), status tracker | orders, payments | orders/, Razorpay SDK |
| 5 | Social | Recommendations, referrals, leaderboard | recommendations, referrals, leaderboard | recommendations/, share cards |
| 6 | Intelligence | Voice search, festivals, need posts, insights | voice, festivals, need_posts, insights | voice/, festival/, need-posts/ |

---

## Foundation (Pre-MVP 1 — No UI)

### F.1 Supabase Migrations

**Files**: `supabase/migrations/001_extensions.sql` through `009_intelligence.sql`

| Migration | Tables / Extensions | Key Details |
|-----------|-------------------|-------------|
| `001_extensions.sql` | `postgis`, `pg_trgm`, `uuid-ossp` | Must run first — geo and search depend on these |
| `002_profiles.sql` | `profiles` | Auto-create trigger on `auth.users`, phone OTP fields, badge/recommendation_count (MVP 5) |
| `003_merchants.sql` | `merchants` | PostGIS `GEOGRAPHY(POINT, 4326)`, GIST index, search vector trigger, denormalized counts |
| `004_services_portfolio.sql` | `services`, `portfolio_images` | Service catalog + work gallery, sort_order for portfolio |
| `005_social.sql` | `follows`, `reviews`, `posts`, `likes`, `comments` | All count triggers (follower, rating, like, comment), self-review prevention |
| `006_chat.sql` | `chat_threads`, `chat_messages` | Realtime enabled, `read_by_user`/`read_by_merchant` booleans, thread `last_message_at` trigger |
| `007_orders.sql` | `orders`, `payment_events` | State CHECK constraint, `payment_events` RLS enabled with NO user policies (service role only), Realtime on orders |
| `008_recommendations.sql` | `recommendations`, `referrals` | Badge promotion trigger on `recommendation_count` threshold |
| `009_intelligence.sql` | `voice_requests`, `festival_plans`, `need_posts`, `merchant_insights` | `need_posts.expires_at` for auto-close, `merchant_insights` service-role-only write |

**Storage buckets** (created by migrations):

| Bucket | Access | Migration |
|--------|--------|-----------|
| `user-avatars` | Public | 002 |
| `merchant-avatars` | Public | 003 |
| `portfolio-images` | Public | 004 |
| `post-media` | Public | 005 |
| `chat-attachments` | Private | 006 |
| `video-intros` | Public | 009 |
| `voice-uploads` | Private | 009 |

### F.2 Backend Core

**Files to create:**

```
backend/app/
├── __init__.py
├── main.py                    # FastAPI app, CORS, /health, mount v1 router
├── core/
│   ├── __init__.py
│   ├── config.py              # Settings: Supabase + Razorpay + Sarvam + LLM keys
│   ├── auth.py                # get_current_user dependency (JWT validation)
│   ├── supabase.py            # get_supabase() + get_user_supabase(token)
│   └── razorpay.py            # Razorpay httpx client wrapper + HMAC verify
├── services/                  # Business logic layer (no HTTP imports)
│   └── __init__.py
├── background/                # FastAPI BackgroundTasks functions
│   └── __init__.py
├── schemas/
│   ├── __init__.py
│   └── common.py              # CursorParams, PaginatedResponse
└── api/v1/
    ├── __init__.py
    └── router.py              # Aggregates all route modules
```

**Config shape** (`core/config.py`):

```python
class Settings(BaseSettings):
    supabase_url: str
    supabase_publishable_default_key: str
    supabase_secret_default_key: str
    razorpay_key_id: str = ""
    razorpay_key_secret: str = ""
    razorpay_webhook_secret: str = ""
    sarvam_api_key: str = ""
    llm_api_key: str = ""
    llm_provider: str = "openai"
    cors_origins: list[str] = ["http://localhost:8081"]
    debug: bool = False
```

### F.3 Frontend Scaffold

```
app/src/
├── lib/
│   ├── api.ts                 # Axios instance + auth interceptor
│   ├── queryClient.ts         # TanStack Query config
│   └── supabase.ts            # Supabase JS (Realtime only)
├── stores/
│   ├── authStore.ts           # Phone OTP auth state
│   ├── locationStore.ts       # GPS coords + permission
│   └── chatStore.ts           # Active thread, unread counts
├── constants/
│   └── theme.ts               # Colors, spacing, typography
└── components/
    ├── ThemedText.tsx
    ├── ThemedView.tsx
    ├── Button.tsx
    └── Input.tsx
```

---

## MVP 1 — Discovery

**Hypothesis**: Can users find local merchants and view their services?

### 1.1 Backend: Auth (Phone OTP)

**Files**: `api/v1/auth.py`, `schemas/auth.py`

| Endpoint | Method | Auth |
|----------|--------|------|
| `/auth/otp/send` | POST | No |
| `/auth/otp/verify` | POST | No |
| `/auth/refresh` | POST | No |
| `/auth/logout` | POST | Bearer |

Schema: `OTPRequest { phone }`, `OTPVerifyRequest { phone, token }`, `AuthResponse { access_token, refresh_token, token_type, expires_in, user }`

### 1.2 Backend: Merchants + Services + Portfolio

**Files**: `api/v1/merchants.py`, `api/v1/services.py`, `api/v1/portfolio.py` + matching schemas

**Merchants** (13 fields including PostGIS location):

| Endpoint | Method | Notes |
|----------|--------|-------|
| `GET /merchants` | GET | Geo query: `lat`, `lng`, `radius`, `category`, `q` |
| `GET /merchants/me` | GET | Own merchant profile |
| `GET /merchants/{id}` | GET | Full detail + services + portfolio |
| `POST /merchants` | POST | Create merchant (user becomes merchant) |
| `PATCH /merchants/{id}` | PATCH | Partial update, owner only |
| `DELETE /merchants/{id}` | DELETE | Owner only |

> **Route order**: `/merchants/me` MUST register before `/{id}` in `router.py`

**Services** (CRUD under merchant):
- `GET/POST /merchants/{mid}/services`
- `PATCH/DELETE /merchants/{mid}/services/{sid}`

**Portfolio** (image gallery):
- `GET/POST /merchants/{mid}/portfolio`
- `DELETE /merchants/{mid}/portfolio/{iid}`
- `PATCH /merchants/{mid}/portfolio/reorder`

### 1.3 Backend: Feed + Search

**Files**: `api/v1/feed.py`, `api/v1/search.py`, `services/geo.py`, `services/search_service.py`

**Feed**:
- `GET /feed/nearby` — PostGIS `ST_DWithin` query, interleaved merchants + posts
- `GET /feed/following` — Posts from followed merchants, cursor-paginated

**Search**:
- `GET /search` — Combined `pg_trgm` + `tsvector`, returns merchants + services

**`services/geo.py`** — PostGIS helper:
```python
def nearby_query(lat, lng, radius_m):
    return f"ST_DWithin(location, ST_MakePoint({lng},{lat})::geography, {radius_m})"
```

### 1.4 Backend: Storage + Users

**Files**: `api/v1/storage.py`, `api/v1/users.py` + schemas

**Storage** — multi-bucket (7 buckets, validated server-side):
- `POST /storage/upload` — accepts `bucket` param, validates against allowlist
- `GET /storage/download/{path}` — signed URL (private) or public URL
- `DELETE /storage/delete/{path}`

**Users**:
- `GET /users/me` — profile
- `PATCH /users/me` — update profile
- `POST /users/me/push-token` — save Expo push token
- `GET /users/me/following` — list of followed merchants

### 1.5 Frontend: Auth + Feed + Merchant + Search

**Auth screens**: `(auth)/phone.tsx`, `(auth)/verify.tsx`
**Feed screens**: `(app)/feed/index.tsx` (Near Me), `(app)/feed/following.tsx`
**Merchant screens**: `(app)/merchant/[id].tsx`, `(app)/merchant/create.tsx`
**Search**: `(app)/search/index.tsx`
**Profile**: `(app)/profile/index.tsx`, `(app)/profile/merchant.tsx`

### 1.6 E2E Tests

- `login-flow.yaml` — enter phone, receive OTP, verify, land on feed
- `browse-feed-flow.yaml` — scroll feed, tap merchant, view profile
- `create-merchant-flow.yaml` — become merchant, add services, upload portfolio

---

## MVP 2 — Trust

**Hypothesis**: Can users decide WHICH merchant to pick?

### 2.1 Backend: Follows + Reviews + Likes + Comments

**Files**: `api/v1/follows.py`, `api/v1/reviews.py`, `api/v1/likes.py`, `api/v1/comments.py` + schemas

**Follows**:
- `POST /merchants/{id}/follow` — 409 if already following
- `DELETE /merchants/{id}/follow`
- `GET /merchants/{id}/followers`

**Reviews** (1–5 stars + text):
- `GET /merchants/{mid}/reviews`
- `POST /merchants/{mid}/reviews` — self-review prevented by RLS policy
- `PATCH /reviews/{id}` — own review only
- `DELETE /reviews/{id}`

**Likes/Comments** (on posts):
- `POST/DELETE /posts/{id}/like`
- `GET/POST /posts/{id}/comments`
- `DELETE /comments/{id}`

All count triggers fire automatically (follower_count, avg_rating, review_count, like_count, comment_count).

### 2.2 Frontend

- Follow button on merchant cards (optimistic update)
- Star rating display on merchant cards
- Review form (stars + text)
- Like button + comment section on posts

### 2.3 E2E

- `follow-flow.yaml` — follow merchant, verify Following feed
- `review-flow.yaml` — write review, verify rating updated

---

## MVP 3 — Engagement

**Hypothesis**: Can merchants and users interact inside the app?

### 3.1 Backend: Chat + Posts

**Files**: `api/v1/chat.py`, `api/v1/posts.py`, `background/push_tasks.py`, `services/push_service.py`

**Chat**:
- `GET /chats` — thread list with last message preview
- `POST /chats` — create thread (user ↔ merchant)
- `GET /chats/{tid}/messages` — cursor-paginated
- `POST /chats/{tid}/messages` — send message, triggers push task
- `PATCH /chats/{tid}/read` — mark read (sets `read_by_user` or `read_by_merchant`)

> **Read status**: Two booleans per message, not one. Frontend must call the correct endpoint.

**Merchant Posts**:
- `POST /merchants/{mid}/posts` — text + image + optional service card
- `GET /merchants/{mid}/posts`
- `DELETE /posts/{id}`

**Background tasks**: `push_tasks.send_chat_push(recipient_id, preview)` — fires after message insert via `BackgroundTasks`.

### 3.2 Frontend

- `(app)/chat/index.tsx` — thread list, unread indicators
- `(app)/chat/[threadId].tsx` — message thread + Supabase Realtime subscription
- Push token registration after login (`expo-notifications`)

### 3.3 Realtime

- `chat_messages` subscription per active thread
- `orders` subscription for status updates (used in MVP 4)

---

## MVP 4 — Transactions

**Hypothesis**: Will users pay and book services inside the app?

### 4.1 Backend: Orders + Payments

**Files**: `api/v1/orders.py`, `api/v1/payments.py`, `services/payment_service.py`

**Orders**:
- `POST /orders` — creates order + Razorpay payment order. `merchant_id` derived server-side from `service_id` (NEVER from request body)
- `GET /orders` — user's or merchant's orders
- `GET /orders/{id}` — detail + status history
- `PATCH /orders/{id}/status` — state machine enforced (see transitions below)
- `POST /orders/{id}/reorder` — quick re-order

**State machine** (`pending_payment → confirmed → in_progress → ready → delivered`, with cancellation):
```
pending_payment → confirmed (webhook only)
confirmed → in_progress | cancelled (merchant)
in_progress → ready (merchant)
ready → delivered (merchant)
pending_payment | confirmed → cancelled (user)
```

**Payments**:
- `POST /payments/webhook` — **NO JWT auth**, HMAC verified. Uses service-role client. Checks replay window (5 min), event ID uniqueness.
- `POST /payments/verify` — client-side verification after Razorpay SDK
- `POST /payments/{id}/refund` — process refund

**`services/payment_service.py`**:
- `create_order_with_payment(admin, supabase, body, user_id)` — lookup merchant from service, create Razorpay order, insert DB row
- `verify_webhook(body, signature, secret)` — HMAC check + replay window + idempotency
- `process_refund(payment_id, amount)` — Razorpay refund API

### 4.2 Frontend

- `(app)/orders/index.tsx` — order list
- `(app)/orders/[id].tsx` — status tracker with Realtime updates
- Razorpay SDK integration (`react-native-razorpay`)

### 4.3 E2E

- `booking-flow.yaml` — select service, place order, complete payment (Razorpay test mode)

---

## MVP 5 — Social

**Hypothesis**: Can the community drive growth organically?

### 5.1 Backend: Recommendations + Referrals + Leaderboard

**Files**: `api/v1/recommendations.py`, `api/v1/referrals.py`, `api/v1/leaderboard.py`, `services/recommendation_service.py`

**Recommendations**:
- `POST /merchants/{id}/recommendations` — create card
- `GET /recommendations/feed`
- `GET /recommendations/{id}/share` — returns deep-link URL

**Referrals**:
- `POST /referrals` — generate referral code
- `GET /referrals/stats` — conversion stats

**Leaderboard**:
- `GET /leaderboard` — top recommenders by neighborhood this month

**Badge logic** (`recommendation_service.py`): When `recommendation_count` crosses threshold → `promote_badge` trigger sets `profiles.badge`.

### 5.2 Frontend

- `(app)/recommendations/index.tsx` — feed + create form
- Shareable recommendation cards (via `expo-sharing`)
- Leaderboard display

---

## MVP 6 — Intelligence

**Hypothesis**: Can the app serve non-tech-savvy users and seasonal demand?

### 6.1 Backend: Voice + Festivals + Need Posts + Insights

**Files**: `api/v1/voice.py`, `api/v1/festivals.py`, `api/v1/need_posts.py`, `api/v1/insights.py`, `services/voice_service.py`, `background/cleanup_tasks.py`

**Voice Search**:
- `POST /voice/search` — multipart audio upload
- Pipeline: audio → Sarvam STT → LLM intent extraction → PostGIS + FTS query → results + TTS URL
- Background task: delete voice upload after processing

**Festivals**:
- `GET /festivals` — upcoming festivals
- `POST /festivals/plans` — create checklist
- `PUT /festivals/plans/{id}` — update items

**Need Posts** ("I Need..."):
- `POST /need-posts` — broadcast to nearby merchants
- `GET /need-posts/feed` — merchants view nearby needs
- `POST /need-posts/{id}/close`
- Background job: auto-close expired posts (`expires_at < now()`)

**Merchant Insights**:
- `GET /merchants/me/insights` — aggregated analytics
- Computed by scheduled background job (pg_cron)

### 6.2 Frontend

- `(app)/voice/index.tsx` — record + animated waveform + results
- `(app)/festival/index.tsx` — festival planner + checklists

---

## Background Jobs Summary

| Job | Type | Frequency | MVP |
|-----|------|-----------|-----|
| Push dispatch (chat) | FastAPI BackgroundTasks | Per message | 3 |
| Push dispatch (order) | FastAPI BackgroundTasks | Per status change | 4 |
| Push dispatch (post) | FastAPI BackgroundTasks | Per post | 3 |
| Voice upload cleanup | FastAPI BackgroundTasks | Per voice search | 6 |
| Compute response_time | pg_cron | Hourly | 1 |
| Compute insights | pg_cron | Daily | 6 |
| Expire need_posts | pg_cron | Every 15 min | 6 |
| Compute leaderboard | pg_cron | Daily | 5 |

---

## Implementation Order

```
1.  Foundation: Supabase migrations (001–009)
2.  Foundation: Backend core (config, auth, supabase, razorpay client)
3.  Foundation: Frontend scaffold (lib, stores, components)
4.  MVP 1: auth.py + schemas + auth screens
5.  MVP 1: merchants.py + services.py + portfolio.py + geo service
6.  MVP 1: feed.py + search.py + search service
7.  MVP 1: storage.py (multi-bucket) + users.py
8.  MVP 1: Frontend feed, merchant, search, profile screens
9.  MVP 1: E2E tests (login, browse, merchant)
10. MVP 2: follows.py + reviews.py + likes.py + comments.py
11. MVP 2: Frontend follow/review/like/comment UI
12. MVP 3: chat.py + posts.py + push_tasks.py + push_service.py
13. MVP 3: Frontend chat screens + Realtime subscription
14. MVP 4: orders.py + payments.py + payment_service.py
15. MVP 4: Frontend order screens + Razorpay SDK
16. MVP 5: recommendations.py + referrals.py + leaderboard.py
17. MVP 5: Frontend recommendation cards + share
18. MVP 6: voice.py + voice_service.py + cleanup_tasks.py
19. MVP 6: festivals.py + need_posts.py + insights.py
20. MVP 6: Frontend voice, festival, need-post screens
```

---

## File Count Estimate

| Layer | Files | Description |
|-------|-------|-------------|
| Supabase | 10 | 9 migrations + config.toml |
| Backend routes | 22 | api/v1/*.py |
| Backend schemas | 22 | schemas/*.py (1 per route + common.py) |
| Backend services | 6 | services/*.py |
| Backend background | 2 | background/*.py |
| Backend core | 4 | config, auth, supabase, razorpay |
| Backend tests | ~30 | Unit + integration per route |
| Frontend screens | ~20 | Expo Router pages |
| Frontend services | ~13 | API service functions |
| Frontend stores | 3 | auth, location, chat |
| Frontend components | ~15 | Shared UI |
| Frontend hooks | ~10 | TanStack Query wrappers |
| Frontend tests | ~20 | Jest + MSW |
| E2E | ~5 | Maestro flows |
| Config | 6 | package.json, pyproject.toml, Dockerfile, docker-compose, app.json, eas.json |
| Docs | 15 | Architecture + guides |
| **Total** | **~200** | Full-stack marketplace |

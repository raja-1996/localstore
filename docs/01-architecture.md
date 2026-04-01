# LocalStore — Architecture

## System Overview

Hyperlocal services marketplace: React Native (Expo) frontend, FastAPI backend, Supabase platform (Auth + PostgreSQL/PostGIS + Realtime + Storage). Social-first discovery for neighborhood businesses in India.

```
┌──────────────────────────────────────┐
│  React Native (Expo SDK 55)          │
│  ┌───────────┐ ┌───────────────────┐ │
│  │ Zustand   │ │ TanStack Query v5 │ │
│  │ (client)  │ │ (server state)    │ │
│  └───────────┘ └────────┬──────────┘ │
│                          │           │
│  Axios ──────────────────┤           │
│  expo-location ──────────┤           │
│  react-native-maps ──────┤           │
│  react-native-razorpay ──┤ (MVP 4)  │
│                          │           │
│  Supabase JS ────────────┼── Realtime WS (direct)
└──────────────────────────┼───────────┘
                           │ HTTPS
┌──────────────────────────┼───────────┐
│  FastAPI Backend         │           │
│  ┌─────────┐ ┌───────────┴────────┐ │
│  │ Auth    │ │ API Routes         │ │
│  │ Guard   │ │ /api/v1/*          │ │
│  └─────────┘ └───────────┬────────┘ │
│                           │         │
│  Supabase Python SDK      │         │
│  httpx (Razorpay, AI)     │         │
│  exponent_server_sdk      │         │
└───────────────────────────┼─────────┘
                            │
┌───────────────────────────┼─────────┐
│  Supabase Cloud           │         │
│  ┌──────────┐ ┌───────────┴───────┐ │
│  │ Auth     │ │ PostgreSQL        │ │
│  │ GoTrue   │ │ + PostGIS         │ │
│  │ Phone OTP│ │ + pg_trgm (FTS)   │ │
│  ├──────────┤ │ + RLS Policies    │ │
│  │ Storage  │ ├───────────────────┤ │
│  │ S3       │ │ Realtime          │ │
│  │ 7 buckets│ │ WebSocket         │ │
│  └──────────┘ └───────────────────┘ │
└─────────────────────────────────────┘
                            │
┌───────────────────────────┼─────────┐
│  External Services                  │
│  ┌──────────┐ ┌───────────────────┐ │
│  │ Razorpay │ │ Expo Push Service │ │
│  │ UPI/Pay  │ │ → FCM + APNs     │ │
│  ├──────────┤ ├───────────────────┤ │
│  │ Sarvam.ai│ │ Google Cloud      │ │
│  │ STT/TTS  │ │ Translate         │ │
│  ├──────────┤ └───────────────────┘ │
│  │ LLM API  │ (MVP 6 only)         │
│  └──────────┘                       │
└─────────────────────────────────────┘
```

---

## Request Flows

### Flow 1 — Geo Discovery (MVP 1)

1. User opens "Near Me" feed
2. `expo-location` provides current GPS coordinates
3. `GET /api/v1/merchants?lat=&lng=&radius=` with Bearer token
4. FastAPI validates JWT via `get_current_user` dependency
5. User-scoped Supabase client runs PostGIS `ST_DWithin` query
6. Returns paginated merchant cards with `distance_meters` injected
7. TanStack Query caches → React renders sorted list

### Flow 2 — Follow + Feed (MVP 2)

1. User taps Follow → `POST /merchants/{id}/follow`
2. FastAPI inserts `follows` row, trigger increments `follower_count`
3. Following feed: `GET /feed/following` → JOINs follows → posts sorted by `created_at DESC`

### Flow 3 — Chat (MVP 3)

1. User sends message → `POST /chats/{thread_id}/messages`
2. FastAPI inserts into `chat_messages`, updates `chat_threads.last_message_at`
3. Supabase Realtime broadcasts INSERT event on `chat_messages`
4. Recipient's app receives via WebSocket subscription (no polling)
5. If recipient offline → FastAPI triggers Expo Push via background task

### Flow 4 — Order + Payment (MVP 4)

1. User taps "Book with Advance" → `POST /orders`
2. FastAPI creates order (status=`pending_payment`), calls Razorpay API
3. Returns `razorpay_order_id` + `razorpay_key` to app
4. App opens Razorpay SDK (UPI payment sheet)
5. On success → Razorpay webhook → `POST /payments/webhook` *(route excluded from JWT auth middleware; HMAC-validated only)*
6. FastAPI verifies HMAC signature → rejects payload older than 5 minutes (replay window) → checks `razorpay_event_id` uniqueness in `payment_events` (duplicate webhooks ignored) → updates order to `confirmed`
7. Supabase Realtime pushes status update to merchant's app

### Flow 5 — Recommendation Card (MVP 5)

1. User writes recommendation → `POST /merchants/{id}/recommendations`
2. FastAPI inserts row, increments `profiles.recommendation_count`
3. Trigger checks badge threshold → upgrades to `local_expert` if qualified
4. Returns shareable deep-link URL for recommendation card

### Flow 6 — Voice Search (MVP 6)

1. User records audio → app uploads via `POST /voice/search` (multipart)
2. FastAPI sends audio to STT API (Sarvam.ai) → gets transcript
3. FastAPI sends transcript to LLM → extracts structured intent: `{category, area, budget, urgency}`
4. FastAPI runs PostGIS + FTS query with extracted params
5. Returns merchant results + TTS audio URL
6. App plays TTS response while showing merchant cards

---

## Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Geo queries | PostGIS `ST_DWithin` + `geography` type | Accurate great-circle distance; native to Postgres |
| Full-text search | `pg_trgm` + `tsvector` | No external service at MVP scale; multilingual-friendly |
| Auth primary | Phone OTP (Supabase GoTrue) | India market: phone is primary identity |
| Auth secondary | Email/password (Supabase GoTrue) | Already integrated in template; fallback option |
| Chat realtime | Supabase Realtime direct WebSocket | Low-latency; already in stack; no extra infra |
| Payments | Razorpay (UPI-first) | Dominant UPI aggregator in India; advance token support |
| Webhook auth | HMAC (no Bearer token) | `POST /payments/webhook` is excluded from auth middleware; signature verified via `X-Razorpay-Signature` |
| Push notifications | Expo Push → FCM/APNs | Single API for both platforms; works with Expo SDK 55 |
| Media storage | Supabase Storage (S3-compatible) | Already in stack; signed URLs for private content |
| Voice/AI (MVP 6) | External STT+LLM API via FastAPI | Swap providers without app changes; no embedded ML |
| Feed sorting | Distance-first (Near Me), recency (Following) | Distance matches "near me" value proposition |
| Denormalized counts | `avg_rating`, `follower_count`, `like_count` on parent | Avoids expensive COUNT queries on every card render |
| Image uploads | Multipart → FastAPI → Supabase Storage | Service-role upload; backend controls path/permissions |
| Environment isolation | Separate Supabase projects per env | dev/staging/prod each have their own project, URL, and anon/service keys — never share a project across environments |

---

## Realtime Subscriptions

| Table | Filter | Purpose |
|-------|--------|---------|
| `chat_messages` | `thread_id = X` | Live 1:1 chat |
| `orders` | `user_id = X` or `merchant_id = X` | Order status updates |
| `posts` | `merchant_id IN (followed)` | Optional: live feed updates |

---

## Storage Buckets

| Bucket | Access | Contents |
|--------|--------|----------|
| `user-avatars` | Public read | User profile photos |
| `merchant-avatars` | Public read | Merchant profile photos |
| `portfolio-images` | Public read | Work portfolio photos |
| `post-media` | Public read | Post photos/images |
| `chat-attachments` | Private (signed URL) | Chat photo attachments (future) |
| `video-intros` | Public read | MVP 6 merchant intro videos |
| `voice-uploads` | Private | MVP 6 voice search audio (temp) |

---

## Directory Structure

```
localstore/
├── app/                              # React Native (Expo)
│   ├── src/
│   │   ├── app/                      # Expo Router file-based routes
│   │   │   ├── (auth)/               # Phone OTP login/signup
│   │   │   ├── (app)/                # Authenticated routes
│   │   │   │   ├── feed/             # Near Me + Following tabs
│   │   │   │   ├── merchant/         # Profile, catalog, portfolio
│   │   │   │   ├── search/           # Category browse, text search
│   │   │   │   ├── chat/             # Inbox, thread
│   │   │   │   ├── orders/           # Order list, status tracker
│   │   │   │   ├── recommendations/  # MVP 5
│   │   │   │   ├── festival/         # Festival planner (MVP 6)
│   │   │   │   ├── voice/            # Voice search (MVP 6)
│   │   │   │   └── profile/          # User profile, merchant dashboard
│   │   │   ├── _layout.tsx           # Root layout (providers)
│   │   │   └── index.tsx             # Auth redirect
│   │   ├── components/               # Shared UI components
│   │   ├── hooks/                    # Custom React hooks
│   │   ├── lib/                      # Axios, query client, supabase client
│   │   ├── services/                 # API service functions (typed)
│   │   │   ├── merchantService.ts
│   │   │   ├── orderService.ts
│   │   │   ├── chatService.ts
│   │   │   └── voiceService.ts
│   │   ├── stores/                   # Zustand stores
│   │   │   ├── authStore.ts
│   │   │   ├── locationStore.ts
│   │   │   └── chatStore.ts
│   │   └── constants/                # Theme, config
│   ├── __tests__/                    # Tests (NOT inside app/)
│   └── package.json
│
├── backend/                          # FastAPI
│   ├── app/
│   │   ├── api/v1/                   # Versioned route handlers (~22 files)
│   │   │   ├── auth.py
│   │   │   ├── users.py              # Profile, push token
│   │   │   ├── merchants.py
│   │   │   ├── services.py           # Service catalog
│   │   │   ├── portfolio.py
│   │   │   ├── feed.py
│   │   │   ├── search.py
│   │   │   ├── follows.py
│   │   │   ├── reviews.py
│   │   │   ├── posts.py
│   │   │   ├── likes.py
│   │   │   ├── comments.py
│   │   │   ├── chat.py
│   │   │   ├── orders.py
│   │   │   ├── payments.py           # Razorpay webhook (no JWT)
│   │   │   ├── recommendations.py    # MVP 5
│   │   │   ├── referrals.py          # MVP 5
│   │   │   ├── leaderboard.py        # MVP 5
│   │   │   ├── voice.py              # MVP 6
│   │   │   ├── festivals.py          # MVP 6
│   │   │   ├── need_posts.py         # MVP 6
│   │   │   ├── insights.py           # MVP 6
│   │   │   └── storage.py
│   │   ├── services/                 # Business logic (no HTTP imports)
│   │   │   ├── geo.py                # PostGIS helpers
│   │   │   ├── search_service.py     # pg_trgm + tsvector
│   │   │   ├── payment_service.py    # Razorpay + HMAC
│   │   │   ├── push_service.py       # Expo push dispatch
│   │   │   ├── recommendation_service.py
│   │   │   └── voice_service.py      # STT → LLM → TTS
│   │   ├── background/               # FastAPI BackgroundTasks
│   │   │   ├── push_tasks.py
│   │   │   └── cleanup_tasks.py
│   │   ├── core/                     # Auth, config, supabase, razorpay
│   │   ├── schemas/                  # Pydantic request/response models
│   │   └── main.py                   # App entrypoint + CORS
│   ├── tests/
│   ├── pyproject.toml
│   └── Dockerfile
│
├── supabase/
│   ├── config.toml
│   └── migrations/
│       ├── 001_extensions.sql        # postgis, pg_trgm, uuid-ossp
│       ├── 002_profiles.sql
│       ├── 003_merchants.sql
│       ├── 004_services_portfolio.sql
│       ├── 005_social.sql            # follows, likes, comments, reviews
│       ├── 006_chat.sql
│       ├── 007_orders.sql
│       ├── 008_recommendations.sql
│       └── 009_intelligence.sql      # voice, festivals, insights
│
├── docker-compose.yml
└── docs/
    ├── 01-architecture.md            # this file
    ├── 02-tech-stack.md
    ├── 05-database-schema.md
    ├── 08-api-reference.md
    └── mvp/                          # per-MVP breakdown docs
        ├── 00-overview.md
        ├── mvp1-discovery.md
        ├── mvp2-trust.md
        ├── mvp3-engagement.md
        ├── mvp4-transactions.md
        ├── mvp5-social.md
        └── mvp6-intelligence.md
```

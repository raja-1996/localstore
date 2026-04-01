# LocalStore — Backend Guide

## Directory Structure

```
backend/app/
├── main.py                        # App factory, CORS, health, mount router
├── api/v1/
│   ├── router.py                  # Aggregates all route modules
│   │
│   │  ── MVP 1 ──
│   ├── auth.py                    # OTP send/verify, refresh, logout
│   ├── users.py                   # /users/me profile, push-token, following list
│   ├── merchants.py               # CRUD, /me, /me/insights route
│   ├── services.py                # Service catalog CRUD (under merchants)
│   ├── portfolio.py               # Portfolio images + reorder
│   ├── feed.py                    # /feed/nearby, /feed/following
│   ├── search.py                  # Combined text+geo search
│   ├── storage.py                 # Upload/signed-url/delete (multi-bucket)
│   │
│   │  ── MVP 2 ──
│   ├── follows.py                 # Follow/unfollow, followers list
│   ├── reviews.py                 # Ratings & reviews CRUD
│   ├── posts.py                   # Merchant posts CRUD
│   ├── likes.py                   # Like/unlike posts
│   ├── comments.py                # Comments CRUD under posts
│   │
│   │  ── MVP 3 ──
│   ├── chat.py                    # Threads, messages, mark-read
│   │
│   │  ── MVP 4 ──
│   ├── orders.py                  # Create, list, get, status, reorder
│   ├── payments.py                # Webhook (NO JWT), verify, refund
│   │
│   │  ── MVP 5 ──
│   ├── recommendations.py         # CRUD, share, card
│   ├── referrals.py               # Create, list, convert
│   ├── leaderboard.py             # GET neighborhood rankings
│   │
│   │  ── MVP 6 ──
│   ├── voice.py                   # POST /voice/search
│   ├── festivals.py               # Festival list + plans CRUD
│   ├── need_posts.py              # Post/list/close needs
│   └── insights.py                # GET /merchants/me/insights
│
├── services/                      # Business logic (no HTTP, no FastAPI imports)
│   ├── geo.py                     # PostGIS ST_DWithin helpers, distance calc
│   ├── search_service.py          # pg_trgm + tsvector query builder
│   ├── payment_service.py         # Razorpay order create, HMAC verify, refund
│   ├── push_service.py            # Expo push dispatch
│   ├── recommendation_service.py  # Badge threshold, share card generation
│   └── voice_service.py           # STT → LLM intent → TTS pipeline
│
├── background/                    # FastAPI BackgroundTasks functions
│   ├── push_tasks.py              # send_chat_push, send_order_push
│   └── cleanup_tasks.py           # delete voice-upload after processing
│
├── core/
│   ├── config.py                  # Settings (pydantic-settings, reads .env)
│   ├── auth.py                    # get_current_user dependency
│   ├── supabase.py                # get_supabase() + get_user_supabase()
│   └── razorpay.py                # Razorpay httpx client wrapper
│
└── schemas/                       # Pydantic request/response models
    ├── common.py                  # CursorParams, PaginatedResponse
    ├── auth.py                    # OTPRequest, OTPVerifyRequest, AuthResponse
    ├── users.py                   # UserProfile, PushTokenRequest
    ├── merchants.py               # MerchantCreate, MerchantDetail, MerchantCard
    ├── services.py                # ServiceCreate, ServiceResponse
    ├── portfolio.py               # PortfolioImage, ReorderRequest
    ├── feed.py                    # FeedItem (union type)
    ├── search.py                  # SearchResponse
    ├── follows.py                 # FollowResponse
    ├── reviews.py                 # ReviewCreate, ReviewResponse
    ├── posts.py                   # PostCreate, PostResponse
    ├── likes.py                   # LikeResponse
    ├── comments.py                # CommentCreate, CommentResponse
    ├── chat.py                    # ThreadResponse, MessageCreate, MessageResponse
    ├── orders.py                  # OrderCreate, OrderResponse, StatusUpdate
    ├── payments.py                # PaymentVerify, WebhookPayload
    ├── recommendations.py         # RecommendationCreate, RecommendationResponse
    ├── referrals.py               # ReferralResponse
    ├── leaderboard.py             # LeaderboardEntry
    ├── voice.py                   # VoiceSearchResponse
    ├── festivals.py               # FestivalPlan, ChecklistItem
    ├── need_posts.py              # NeedPostCreate, NeedPostResponse
    └── storage.py                 # UploadResponse, DownloadResponse
```

### Why This Structure

- **Flat routes**: ~22 route files in `api/v1/` — cross-domain dependencies (feed uses merchants + follows + posts) make subdirectory grouping awkward. FastAPI's `tags` parameter handles OpenAPI grouping.
- **Services layer**: Business logic extracted from route handlers into plain Python functions. Route handlers become thin: validate → call service → return. Makes logic testable without HTTP.
- **Background tasks folder**: Importable and testable standalone. Single place to debug push/cleanup issues.
- **Payments separate from orders**: `POST /payments/webhook` is excluded from JWT auth middleware — easier to control when the router is isolated.
- **Insights separate from merchants**: Complex aggregation query. Route `/merchants/me/insights` must register before `/{id}` to avoid path parameter collision.

---

## Authentication

### Phone OTP Flow (Primary)

1. Client calls `POST /auth/otp/send` with phone number
2. Supabase Auth sends OTP via configured SMS provider (Twilio/MSG91)
3. Client calls `POST /auth/otp/verify` with phone + OTP code
4. Returns `access_token`, `refresh_token`, user profile
5. All subsequent requests include `Authorization: Bearer <access_token>`

### `core/auth.py` — JWT Dependency

```python
async def get_current_user(authorization: str = Header(...)) -> dict:
    token = authorization.replace("Bearer ", "")
    # Validates token against Supabase Auth
    # Returns { "id": "uuid", "phone": "+91...", "token": "..." }
```

Every protected route declares `user=Depends(get_current_user)`.

> **Gotcha — Error handling**: The current implementation uses bare `except Exception` which catches all errors (including 503 network errors from Supabase) and re-raises as 401. This masks transient infrastructure failures. Distinguish `AuthApiError` (→ 401) from network/timeout errors (→ 503).

> **Gotcha — Client choice**: Token validation uses `get_supabase()` (service role) for `auth.get_user(token)`. This works but is heavier than needed. Consider a lightweight JWT validation that doesn't require the admin client.

### `core/supabase.py` — Client Factory

Two client modes:

| Function | Key Used | When to Use |
|----------|----------|-------------|
| `get_supabase()` | Service role (secret key) | Auth admin ops, `payment_events` writes, `merchant_insights` writes |
| `get_user_supabase(token)` | Anon key + JWT header | Everything else — enforces RLS |

- `get_supabase()` is cached via `lru_cache` — singleton for the process lifetime
- `get_user_supabase(token)` creates a new client per request — must not be cached (JWT changes per user)

> **Rule**: Use `get_user_supabase` by default. Only use `get_supabase` for: auth admin, payment events, merchant insights, and storage uploads requiring service-role permissions.

---

## Route Endpoints by MVP

See `docs/08-api-reference.md` for full request/response shapes.

### MVP 1 — Discovery

| Method | Path | Auth | Route File |
|--------|------|------|------------|
| POST | `/auth/otp/send` | No | auth.py |
| POST | `/auth/otp/verify` | No | auth.py |
| POST | `/auth/refresh` | No | auth.py |
| POST | `/auth/logout` | Bearer | auth.py |
| GET | `/users/me` | Bearer | users.py |
| PATCH | `/users/me` | Bearer | users.py |
| POST | `/users/me/push-token` | Bearer | users.py |
| GET | `/users/me/following` | Bearer | users.py |
| GET | `/merchants` | Bearer | merchants.py |
| GET | `/merchants/me` | Bearer | merchants.py |
| GET | `/merchants/{id}` | Bearer | merchants.py |
| POST | `/merchants` | Bearer | merchants.py |
| PATCH | `/merchants/{id}` | Bearer | merchants.py |
| DELETE | `/merchants/{id}` | Bearer | merchants.py |
| GET | `/merchants/{mid}/services` | Bearer | services.py |
| POST | `/merchants/{mid}/services` | Bearer | services.py |
| PATCH | `/merchants/{mid}/services/{sid}` | Bearer | services.py |
| DELETE | `/merchants/{mid}/services/{sid}` | Bearer | services.py |
| GET | `/merchants/{mid}/portfolio` | Bearer | portfolio.py |
| POST | `/merchants/{mid}/portfolio` | Bearer | portfolio.py |
| DELETE | `/merchants/{mid}/portfolio/{iid}` | Bearer | portfolio.py |
| PATCH | `/merchants/{mid}/portfolio/reorder` | Bearer | portfolio.py |
| GET | `/feed/nearby` | Bearer | feed.py |
| GET | `/feed/following` | Bearer | feed.py |
| GET | `/search` | Bearer | search.py |
| POST | `/storage/upload` | Bearer | storage.py |
| GET | `/storage/download/{bucket}/{path}` | Bearer | storage.py |
| DELETE | `/storage/delete/{bucket}/{path}` | Bearer | storage.py |

### MVP 2 — Trust

| Method | Path | Auth | Route File |
|--------|------|------|------------|
| POST | `/merchants/{id}/follow` | Bearer | follows.py |
| DELETE | `/merchants/{id}/follow` | Bearer | follows.py |
| GET | `/merchants/{id}/followers` | Bearer | follows.py |
| GET | `/merchants/{mid}/reviews` | Bearer | reviews.py |
| POST | `/merchants/{mid}/reviews` | Bearer | reviews.py |
| PATCH | `/reviews/{id}` | Bearer | reviews.py |
| DELETE | `/reviews/{id}` | Bearer | reviews.py |
| POST | `/posts/{id}/like` | Bearer | likes.py |
| DELETE | `/posts/{id}/like` | Bearer | likes.py |
| GET | `/posts/{id}/comments` | Bearer | comments.py |
| POST | `/posts/{id}/comments` | Bearer | comments.py |
| DELETE | `/comments/{id}` | Bearer | comments.py |

### MVP 3 — Engagement

| Method | Path | Auth | Route File |
|--------|------|------|------------|
| POST | `/merchants/{mid}/posts` | Bearer | posts.py |
| GET | `/merchants/{mid}/posts` | Bearer | posts.py |
| DELETE | `/posts/{id}` | Bearer | posts.py |
| GET | `/chats` | Bearer | chat.py |
| POST | `/chats` | Bearer | chat.py |
| GET | `/chats/{tid}/messages` | Bearer | chat.py |
| POST | `/chats/{tid}/messages` | Bearer | chat.py |
| PATCH | `/chats/{tid}/read` | Bearer | chat.py |

### MVP 4 — Transactions

| Method | Path | Auth | Route File |
|--------|------|------|------------|
| POST | `/orders` | Bearer | orders.py |
| GET | `/orders` | Bearer | orders.py |
| GET | `/orders/{id}` | Bearer | orders.py |
| PATCH | `/orders/{id}/status` | Bearer | orders.py |
| POST | `/orders/{id}/reorder` | Bearer | orders.py |
| POST | `/payments/verify` | Bearer | payments.py |
| POST | `/payments/webhook` | **None** (HMAC) | payments.py |
| POST | `/payments/{id}/refund` | Bearer | payments.py |

### MVP 5 — Social

| Method | Path | Auth | Route File |
|--------|------|------|------------|
| POST | `/merchants/{id}/recommendations` | Bearer | recommendations.py |
| GET | `/recommendations/feed` | Bearer | recommendations.py |
| GET | `/recommendations/{id}/share` | Bearer | recommendations.py |
| POST | `/referrals` | Bearer | referrals.py |
| GET | `/referrals/stats` | Bearer | referrals.py |
| GET | `/leaderboard` | Bearer | leaderboard.py |

### MVP 6 — Intelligence

| Method | Path | Auth | Route File |
|--------|------|------|------------|
| POST | `/voice/search` | Bearer | voice.py |
| GET | `/festivals` | Bearer | festivals.py |
| POST | `/festivals/plans` | Bearer | festivals.py |
| PUT | `/festivals/plans/{id}` | Bearer | festivals.py |
| POST | `/need-posts` | Bearer | need_posts.py |
| GET | `/need-posts/feed` | Bearer | need_posts.py |
| POST | `/need-posts/{id}/close` | Bearer | need_posts.py |
| GET | `/merchants/me/insights` | Bearer | insights.py |

### Health (not versioned)

| Method | Path | Auth | Route File |
|--------|------|------|------------|
| GET | `/health` | None | main.py |

---

## Services Layer

The `services/` folder contains business logic — no HTTP, no FastAPI imports. Route handlers call service functions.

### Pattern

```python
# api/v1/orders.py (thin route handler)
@router.post("/orders")
async def create_order(body: OrderCreate, user=Depends(get_current_user)):
    supabase = get_user_supabase(user["token"])
    admin = get_supabase()
    result = await payment_service.create_order_with_payment(admin, supabase, body, user["id"])
    return result

# services/payment_service.py (business logic)
async def create_order_with_payment(admin, supabase, body, user_id):
    service = supabase.table("services").select("*").eq("id", body.service_id).single().execute()
    merchant_id = service.data["merchant_id"]  # ← server-derived, never from client
    # ... create Razorpay order, insert order row, etc.
```

### Service Modules

| Module | Purpose | MVP |
|--------|---------|-----|
| `geo.py` | PostGIS `ST_DWithin` query builder, distance calculation | 1 |
| `search_service.py` | Combined `pg_trgm` + `tsvector` query, result ranking | 1 |
| `payment_service.py` | Razorpay order creation, HMAC verification, refund processing | 4 |
| `push_service.py` | Expo Push notification dispatch via `exponent_server_sdk` | 3 |
| `recommendation_service.py` | Badge threshold checks, shareable card deep-link generation | 5 |
| `voice_service.py` | STT → LLM intent extraction → TTS pipeline orchestration | 6 |

---

## Key Patterns

### Pagination Contract

All list endpoints use **cursor-based pagination** with a consistent shape:

```python
# schemas/common.py
class CursorParams(BaseModel):
    limit: int = 20
    before: str | None = None  # cursor = last item's ID or timestamp

class PaginatedResponse(BaseModel):
    data: list
    has_more: bool
    next_cursor: str | None = None
```

- `before`: pass the last item's ID to get the next page
- `has_more`: `true` if more items exist after this page
- `next_cursor`: convenience field — the cursor value for the next request

> **Why cursor, not offset**: Offset pagination breaks with real-time inserts (items shift between pages). Cursor pagination is stable and performant on large tables.

### Order State Machine

Orders follow a strict state transition model. The backend **must enforce** valid transitions.

```
pending_payment → confirmed → in_progress → ready → delivered
       │              │
       └→ cancelled    └→ cancelled
```

**Enforcement pattern** in `api/v1/orders.py`:

```python
VALID_TRANSITIONS = {
    "pending_payment": ["confirmed", "cancelled"],
    "confirmed": ["in_progress", "cancelled"],
    "in_progress": ["ready"],
    "ready": ["delivered"],
}

async def update_status(order_id, new_status, user):
    current = get_order(order_id)
    if new_status not in VALID_TRANSITIONS.get(current.status, []):
        raise HTTPException(400, f"Cannot transition from {current.status} to {new_status}")
```

**Who can transition:**
- `pending_payment → confirmed`: system only (via Razorpay webhook)
- `confirmed → in_progress/cancelled`: merchant
- `in_progress → ready`: merchant
- `ready → delivered`: merchant
- `any → cancelled`: user (before `in_progress`), merchant (any time)

### Server-Derived `merchant_id`

The `OrderCreate` schema must **never** accept `merchant_id` from the client:

```python
# schemas/orders.py
class OrderCreate(BaseModel):
    service_id: str
    notes: str | None = None
    # NO merchant_id field — always derived server-side from service_id
```

The backend looks up `merchant_id` from the `services` table using `service_id`. This prevents IDOR attacks where a user creates an order attributed to a different merchant.

### Phone Number Masking

`GET /merchants/{id}` returns phone/whatsapp in the response. To prevent spam:
- **Mask by default**: show only last 4 digits (`*****3210`)
- **Full phone visible**: only to the merchant themselves (`user_id == auth.uid()`) or after a chat thread exists between user and merchant
- Implementation: handle in the route handler, not RLS (RLS can't conditionally mask fields)

### Storage Multi-Bucket

Unlike the template (single `uploads` bucket), LocalStore uses 7 buckets. The upload route accepts a `bucket` parameter:

```python
@router.post("/storage/upload")
async def upload(file: UploadFile, bucket: str, path: str | None = None, user=Depends(get_current_user)):
    ALLOWED_BUCKETS = {"user-avatars", "merchant-avatars", "portfolio-images", "post-media", "chat-attachments", "video-intros", "voice-uploads"}
    if bucket not in ALLOWED_BUCKETS:
        raise HTTPException(400, f"Invalid bucket: {bucket}")
    # auto-generate path: {user_id}/{uuid}.{ext}
```

Public buckets (`user-avatars`, `merchant-avatars`, `portfolio-images`, `post-media`, `video-intros`) use **unsigned public URLs** for CDN cacheability. Private buckets (`chat-attachments`, `voice-uploads`) use **signed URLs** (1-hour expiry).

---

## Background Tasks

### Pattern

Background tasks use FastAPI's `BackgroundTasks` for fire-and-forget operations:

```python
@router.post("/chats/{thread_id}/messages")
async def send_message(body: MessageCreate, bg: BackgroundTasks, user=Depends(get_current_user)):
    # ... insert message ...
    bg.add_task(push_tasks.send_chat_push, recipient_id, message_preview)
    return message
```

### Task Modules

| Module | Functions | Trigger |
|--------|-----------|---------|
| `push_tasks.py` | `send_chat_push`, `send_order_push`, `send_post_push` | After chat message, order status change, merchant post |
| `cleanup_tasks.py` | `delete_voice_upload` | After voice search processing complete |

### Limitations

- **No retry**: If Expo Push Service is down, the push is silently lost. FastAPI `BackgroundTasks` has no retry mechanism. For critical notifications (order status), consider adding a `notification_queue` table as a fallback log.
- **Process-bound**: Background tasks die if the worker process restarts. They're suitable for push dispatch (~100ms) but not for long-running jobs.

### Background Jobs (Scheduled)

These are **not** FastAPI BackgroundTasks — they require a separate scheduler (cron, Celery, or Supabase pg_cron):

| Job | Frequency | Purpose |
|-----|-----------|---------|
| `compute_response_time` | Hourly | Calculate `merchants.response_time_minutes` from chat message timestamps |
| `compute_insights` | Daily | Aggregate `merchant_insights` from orders + chat data |
| `expire_need_posts` | Every 15 min | Close `need_posts` where `expires_at < now()` |
| `compute_leaderboard` | Daily | Recalculate neighborhood leaderboard rankings |

> **Implementation choice**: For MVP, use Supabase `pg_cron` extension to run these as SQL functions inside Postgres. No external scheduler needed.

---

## Configuration

### `core/config.py`

```python
class Settings(BaseSettings):
    # Supabase
    supabase_url: str
    supabase_publishable_default_key: str
    supabase_secret_default_key: str

    # Razorpay (MVP 4+)
    razorpay_key_id: str = ""
    razorpay_key_secret: str = ""
    razorpay_webhook_secret: str = ""

    # AI/Voice (MVP 6)
    sarvam_api_key: str = ""
    llm_api_key: str = ""
    llm_provider: str = "openai"

    # App
    cors_origins: list[str] = ["http://localhost:8081"]
    debug: bool = False

    model_config = SettingsConfigDict(env_file=".env")
```

### `core/razorpay.py`

Wraps Razorpay API calls via `httpx`:

```python
class RazorpayClient:
    def __init__(self, key_id: str, key_secret: str):
        self.client = httpx.AsyncClient(
            base_url="https://api.razorpay.com/v1",
            auth=(key_id, key_secret)
        )

    async def create_order(self, amount_paise: int, receipt: str) -> dict: ...
    async def fetch_payment(self, payment_id: str) -> dict: ...
    async def refund(self, payment_id: str, amount_paise: int) -> dict: ...

def verify_webhook_signature(body: bytes, signature: str, secret: str) -> bool:
    expected = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature)
```

---

## Webhook Security

The `POST /payments/webhook` route is special:

1. **Excluded from JWT auth middleware** — Razorpay sends requests with HMAC signature, not Bearer tokens
2. **HMAC verification** — `X-Razorpay-Signature` header validated against `RAZORPAY_WEBHOOK_SECRET`
3. **Replay protection** — reject payloads with timestamp older than 5 minutes
4. **Idempotency** — check `razorpay_event_id` uniqueness in `payment_events` table (duplicate webhooks are silently ignored)
5. **Service role client** — uses `get_supabase()` because `payment_events` has no user-facing RLS policies

Router registration in `router.py`:

```python
v1_router.include_router(payments.router, prefix="/payments", tags=["Payments"])
# payments.router internally marks the webhook route with no auth dependency
```

---

## Deployment

See `docs/10-deployment-backend.md` for the full Dockerfile and production deployment guide.

---

## CORS

Configured in `main.py`. Default origins: `http://localhost:8081` (Expo dev server), `http://localhost:19006` (Expo web).

Override via `CORS_ORIGINS` env var (JSON array).

> **Production**: Always set explicit domain list. Never use `"*"` — it defeats CORS protection entirely.

See `docs/10-deployment-backend.md` for detailed production CORS configuration and testing.

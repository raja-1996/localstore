# LocalStore — API Reference

## Base URL

```
http://localhost:8000/api/v1
```

All endpoints except `/auth/*` and `GET /health` require `Authorization: Bearer <access_token>`.

## Error Response Format

```json
{ "detail": "Error message here" }
```

| Code | Meaning |
|------|---------|
| 400 | Bad request / validation error |
| 401 | Missing or invalid token |
| 402 | Payment failed |
| 403 | Not the owner / not authorized |
| 404 | Resource not found |
| 409 | Conflict (already following, already reviewed, etc.) |
| 422 | Unprocessable entity (Pydantic validation) |

---

## Auth (MVP 1)

### `POST /auth/otp/send`

Send OTP to phone number.

```json
// Request
{ "phone": "+919876543210" }

// Response 200
{ "message": "OTP sent" }
```

### `POST /auth/otp/verify`

Verify OTP and get tokens.

```json
// Request
{ "phone": "+919876543210", "token": "123456" }

// Response 200
{
  "access_token": "eyJ...",
  "refresh_token": "eyJ...",
  "token_type": "bearer",
  "expires_in": 3600,
  "user": { "id": "uuid", "phone": "+919876543210" }
}
```

### `POST /auth/refresh`

```json
// Request
{ "refresh_token": "eyJ..." }

// Response 200 — same shape as verify
```

### `POST /auth/logout`

Response 204 (no body).

---

## Merchants (MVP 1)

> **FastAPI route registration order:** `/merchants/me` and `/merchants/me/insights` MUST be registered BEFORE `/{id}` routes, otherwise FastAPI matches `me` as an `{id}` path parameter.

### `GET /merchants`

Browse merchants by location, category, or search.

**Query params:** `lat` (float), `lng` (float), `radius` (int, meters, default 5000), `category` (string), `q` (text search), `limit` (int, default 20), `before` (cursor = `{distance}_{id}`)

```json
// Response 200
{
  "data": [
    {
      "id": "uuid",
      "name": "Lakshmi's Kitchen",
      "category": "Food",
      "avg_rating": 4.8,
      "review_count": 23,
      "follower_count": 156,
      "avatar_url": "https://...",
      "distance_meters": 450,
      "neighborhood": "Jayanagar 4th Block",
      "is_active": true
    }
  ],
  "has_more": true,
  "next_cursor": "450_uuid-of-last-merchant"
}
```

### `GET /merchants/{id}`

Full merchant detail.

> **Phone masking**: `phone` and `whatsapp` are masked by default (`"*****3210"`). Full number visible only to: the merchant themselves, or users who have an existing chat thread with this merchant. This is enforced in the route handler, not RLS.

```json
// Response 200
{
  "id": "uuid",
  "name": "Lakshmi's Kitchen",
  "category": "Food",
  "description": "Homemade sweets and snacks for 15 years",
  "tags": ["Sweets", "Snacks", "Homemade"],
  "avg_rating": 4.8,
  "review_count": 23,
  "follower_count": 156,
  "avatar_url": "https://...",
  "phone": "*****3210",
  "whatsapp": "*****3210",
  "address_text": "Jayanagar 4th Block, Bangalore",
  "neighborhood": "Jayanagar 4th Block",
  "service_radius_meters": 5000,
  "response_time_minutes": 20,
  "video_intro_url": null,
  "services": [ /* Service[] */ ],
  "portfolio": [ /* PortfolioImage[] */ ],
  "is_active": true,
  "created_at": "2026-03-01T10:00:00Z"
}
```

### `POST /merchants`

Create merchant profile.

```json
// Request
{
  "name": "Lakshmi's Kitchen",
  "description": "Homemade sweets and snacks",
  "category": "Food",
  "tags": ["Sweets", "Snacks"],
  "lat": 12.9259,
  "lng": 77.5838,
  "address_text": "Jayanagar 4th Block, Bangalore",
  "neighborhood": "Jayanagar 4th Block",
  "service_radius_meters": 5000,
  "phone": "+919876543210",
  "whatsapp": "+919876543210"
}

// Response 201 — MerchantDetail
```

### `PATCH /merchants/{id}`

Update merchant profile (partial fields from POST body). Response 200: updated MerchantDetail. 403 if not owner.

### `DELETE /merchants/{id}`

Response 204. 403 if not owner.

### `GET /merchants/me`

Returns own merchant profile. Response 200: MerchantDetail.

---

## Services / Catalog (MVP 1)

### `GET /merchants/{merchant_id}/services`

```json
// Response 200
[
  {
    "id": "uuid",
    "merchant_id": "uuid",
    "name": "Diwali Sweet Box (1kg)",
    "description": "Assorted homemade sweets",
    "price": 500.00,
    "price_unit": "per box",
    "image_url": "https://...",
    "is_available": true,
    "cancellation_policy": "Refund if cancelled 24h before",
    "advance_percent": 20
  }
]
```

### `POST /merchants/{merchant_id}/services`

Multipart or JSON. Response 201: Service.

### `PATCH /merchants/{merchant_id}/services/{service_id}`

Partial update. Response 200: updated Service.

### `DELETE /merchants/{merchant_id}/services/{service_id}`

Response 204.

---

## Portfolio (MVP 1)

### `GET /merchants/{merchant_id}/portfolio`

```json
// Response 200
[
  {
    "id": "uuid",
    "image_url": "https://...",
    "caption": "Diwali special laddoos",
    "order_id": null,
    "sort_order": 0
  }
]
```

### `POST /merchants/{merchant_id}/portfolio`

Multipart: `file` (image), `caption` (text), `sort_order` (int). Response 201.

### `DELETE /merchants/{merchant_id}/portfolio/{image_id}`

Response 204.

### `PATCH /merchants/{merchant_id}/portfolio/reorder`

```json
// Request
{ "order": ["uuid1", "uuid2", "uuid3"] }

// Response 200
{ "message": "reordered" }
```

---

## Feed (MVP 1 + MVP 2)

### `GET /feed/nearby`

Interleaved posts and merchants sorted by distance. Use `GET /merchants` for a merchant-list-only view.

**Query params:** `lat`, `lng`, `radius` (meters), `category`, `limit` (default 20), `before` (cursor = last item's composite key `{distance}_{id}`)

> **Pagination**: Uses cursor-based pagination (not offset). The cursor encodes both distance and ID to maintain stable ordering with real-time inserts. Pass the `next_cursor` from the response as `before` in the next request.

```json
// Response 200
{
  "data": [ /* interleaved: MerchantCard | Post, each with distance_meters */ ],
  "has_more": true,
  "next_cursor": "450_uuid-of-last-item"
}
```

### `GET /feed/following`

Posts from followed merchants, sorted by recency.

**Query params:** `limit` (default 20), `before` (cursor = post ID)

```json
// Response 200
{
  "data": [ /* Post[] */ ],
  "has_more": true,
  "next_cursor": "uuid-of-last-post"
}
```

---

## Search (MVP 1)

### `GET /search`

Combined merchant + service search using `pg_trgm` + `tsvector`.

**Query params:** `q` (text), `lat`, `lng`, `radius`, `category`, `min_rating` (float), `max_price` (float), `limit`, `offset`

```json
// Response 200
{
  "merchants": [ /* MerchantCard[] */ ],
  "services": [
    {
      "id": "uuid",
      "merchant": { "id": "uuid", "name": "...", "avatar_url": "..." },
      "name": "Bridal Mehendi",
      "price": 2000.00,
      "image_url": "https://..."
    }
  ]
}
```

---

## Follows (MVP 2)

### `POST /merchants/{id}/follow`

```json
// Response 201
{ "merchant_id": "uuid", "followed_at": "2026-03-01T10:00:00Z" }

// 409 if already following
```

### `DELETE /merchants/{id}/follow`

Response 204. 404 if not following.

### `GET /merchants/{id}/followers`

```json
// Response 200
{
  "data": [{ "id": "uuid", "full_name": "Priya", "avatar_url": "https://..." }],
  "count": 156
}
```

### `GET /users/me/following`

```json
// Response 200
{ "data": [ /* MerchantCard[] */ ] }
```

---

## Reviews (MVP 2)

### `GET /merchants/{merchant_id}/reviews`

**Query params:** `limit`, `offset`

```json
// Response 200
{
  "data": [
    {
      "id": "uuid",
      "reviewer": { "id": "uuid", "full_name": "Priya", "avatar_url": "https://..." },
      "rating": 5,
      "text": "Best laddoos in the neighborhood!",
      "is_verified_purchase": false,
      "created_at": "2026-03-15T14:30:00Z"
    }
  ],
  "avg_rating": 4.8,
  "count": 23
}
```

### `POST /merchants/{merchant_id}/reviews`

```json
// Request
{ "rating": 5, "text": "Best laddoos in the neighborhood!" }

// Response 201 — Review
// 409 if already reviewed
```

### `PATCH /merchants/{merchant_id}/reviews/{review_id}`

```json
// Request
{ "rating": 4, "text": "Updated review..." }

// Response 200 — updated Review
```

### `DELETE /merchants/{merchant_id}/reviews/{review_id}`

Response 204.

---

## Posts (MVP 3)

### `GET /merchants/{merchant_id}/posts`

**Query params:** `limit`, `before` (cursor)

```json
// Response 200
{
  "data": [
    {
      "id": "uuid",
      "merchant_id": "uuid",
      "content": "Diwali special laddoos now available!",
      "image_url": "https://...",
      "post_type": "offer",
      "service": { "id": "uuid", "name": "Sweet Box", "price": 500 },
      "like_count": 42,
      "comment_count": 8,
      "is_liked_by_me": true,
      "created_at": "2026-03-20T09:00:00Z"
    }
  ]
}
```

### `POST /merchants/{merchant_id}/posts`

Multipart: `content` (text), `file` (image, optional), `post_type`, `service_id` (optional). Response 201.

### `PATCH /merchants/{merchant_id}/posts/{post_id}`

```json
// Request
{ "content": "Updated content", "service_id": "uuid" }

// Response 200 — updated Post
```

### `DELETE /merchants/{merchant_id}/posts/{post_id}`

Response 204.

---

## Likes (MVP 2)

### `POST /posts/{post_id}/like`

```json
// Response 201
{ "liked": true }

// 409 if already liked
```

### `DELETE /posts/{post_id}/like`

Response 204.

---

## Comments (MVP 2)

### `GET /posts/{post_id}/comments`

```json
// Response 200
{
  "data": [
    {
      "id": "uuid",
      "user": { "id": "uuid", "full_name": "Priya", "avatar_url": "https://..." },
      "content": "These look amazing!",
      "created_at": "2026-03-20T09:30:00Z"
    }
  ]
}
```

### `POST /posts/{post_id}/comments`

```json
// Request
{ "content": "These look amazing!" }

// Response 201 — Comment
```

### `PATCH /posts/{post_id}/comments/{comment_id}`

```json
// Request
{ "content": "Updated comment text" }

// Response 200 — updated Comment
// 403 if not own comment
```

### `DELETE /posts/{post_id}/comments/{comment_id}`

Response 204.

---

## Chat (MVP 3)

### `GET /chats`

List own chat threads.

```json
// Response 200
{
  "data": [
    {
      "id": "uuid",
      "merchant": { "id": "uuid", "name": "Lakshmi's Kitchen", "avatar_url": "https://..." },
      "last_message": { "content": "Your order is ready!", "created_at": "2026-03-20T15:00:00Z" },
      "unread_count": 2
    }
  ]
}
```

### `POST /chats`

Start or get existing thread.

```json
// Request
{ "merchant_id": "uuid" }

// Response 201 (new) or 200 (existing) — Thread
```

### `GET /chats/{thread_id}/messages`

**Query params:** `limit`, `before` (cursor)

```json
// Response 200
{
  "data": [
    {
      "id": "uuid",
      "sender_id": "uuid",
      "content": "Hi, do you make eggless cakes?",
      "read_by_user": true,
      "read_by_merchant": false,
      "created_at": "2026-03-20T14:00:00Z"
    }
  ]
}
```

### `POST /chats/{thread_id}/messages`

```json
// Request
{ "content": "Hi, do you make eggless cakes?" }

// Response 201 — ChatMessage
```

### `PATCH /chats/{thread_id}/read`

Mark all messages as read.

```json
// Response 200
{ "marked_read": 5 }
```

---

## Push Token (MVP 3)

### `PUT /users/me/push-token`

Register Expo push token.

```json
// Request
{ "token": "ExponentPushToken[xxxxxxxxxxxx]" }

// Response 200
{ "registered": true }
```

---

## Orders (MVP 4)

### `POST /orders`

Create order and initiate Razorpay payment.

```json
// Request
{
  "service_id": "uuid",
  "quantity": 1,
  "requirements_text": "No cashew in the sweet box",
  "requirements_image_url": null
}
// Note: total_amount computed server-side from service.price * quantity
// Note: merchant_id derived server-side from service.merchant_id — do not send in request body

// Response 201
{
  "order": {
    "id": "uuid",
    "status": "pending_payment",
    "service": { "id": "uuid", "name": "Sweet Box", "price": 500 },
    "total_amount": 500.00,
    "advance_amount": 100.00,
    "balance_amount": 400.00,
    "created_at": "2026-03-20T10:00:00Z"
  },
  "razorpay_order_id": "order_xxxxxxxxxxxxx",
  "razorpay_key": "rzp_live_xxxxx"
}
```

### `GET /orders`

**Query params:** `role` (customer | merchant), `status`, `limit`, `offset`

```json
// Response 200
{ "data": [ /* Order[] with merchant + service embedded */ ] }
```

### `GET /orders/{id}`

Full order detail. Response 200. 403 if not participant.

### `PATCH /orders/{id}/status`

Merchant updates status. User can cancel pending orders.

```json
// Request (merchant)
{ "status": "in_progress" }
// State transition table:
// | From              | To           | Who                |
// |-------------------|--------------|---------------------|
// | pending_payment   | confirmed    | system (webhook)    |
// | pending_payment   | cancelled    | user or merchant    |
// | confirmed         | in_progress  | merchant            |
// | confirmed         | cancelled    | user or merchant    |
// | in_progress       | ready        | merchant            |
// | ready             | delivered    | merchant            |
// | confirmed+        | refunded     | merchant (via /refund) |

// Response 200 — updated Order
```

### `POST /orders/{id}/reorder`

Quick re-order same service. Response 201: new Order (requires Razorpay confirmation).

---

## Payments (MVP 4)

### `POST /payments/webhook`

Razorpay webhook endpoint. No auth header — validated by HMAC signature.

> **Security notes:**
> - HMAC signature verified using `X-Razorpay-Signature` header before any processing.
> - Route is **excluded from JWT auth middleware** — does not require Bearer token.
> - `razorpay_event_id` uniqueness checked in `payment_events` — duplicate webhooks silently ignored (idempotent).
> - Replay window: reject events where `created_at` timestamp in payload is older than **5 minutes** from server time.

```json
// Request — Razorpay event payload
// Handles: payment.captured → order to 'confirmed'
//          refund.created → order to 'refunded'

// Response 200
{ "received": true }
```

### `POST /payments/verify`

Client-side payment verification after Razorpay SDK callback. Call this after the Razorpay payment sheet closes successfully to confirm the payment is genuine before showing the success screen (belt-and-suspenders alongside webhook).

```json
// Request
{
  "razorpay_order_id": "order_xxxxxxxxxxxxx",
  "razorpay_payment_id": "pay_xxxxxxxxxxxxx",
  "razorpay_signature": "hmac_sha256_hex"
}

// Response 200
{ "verified": true, "order_id": "uuid", "status": "confirmed" }

// Response 400 — signature mismatch
{ "detail": "Payment verification failed" }
```

### `POST /orders/{id}/refund`

Initiate refund.

```json
// Request
{ "reason": "Customer changed mind" }

// Response 200
{ "refund_id": "rfnd_xxxxxxxxxxxxx", "status": "refunded" }
```

---

## Recommendations (MVP 5)

### `GET /merchants/{merchant_id}/recommendations`

```json
// Response 200
{
  "data": [
    {
      "id": "uuid",
      "recommender": {
        "id": "uuid",
        "full_name": "Kavitha",
        "avatar_url": "https://...",
        "badge": "local_expert"
      },
      "text": "Best sweets in Jayanagar. Order the laddoos!",
      "is_verified": true,
      "created_at": "2026-03-10T12:00:00Z"
    }
  ],
  "count": 15
}
```

### `POST /merchants/{merchant_id}/recommendations`

```json
// Request
{ "text": "Best sweets in Jayanagar!", "order_id": "uuid" }

// Response 201 — Recommendation
// 409 if already recommended
```

### `DELETE /merchants/{merchant_id}/recommendations/{id}`

Response 204.

### `POST /recommendations/{id}/shared`

Increment `share_count` when user shares a recommendation card.

```json
// Response 200
{ "share_count": 6 }
```

### `GET /recommendations/card/{id}`

Shareable recommendation card data.

```json
// Response 200
{
  "recommendation": { /* Recommendation */ },
  "merchant": { /* MerchantCard */ },
  "share_url": "https://localstore.app/r/abc123"
}
```

---

## Leaderboard (MVP 5)

### `GET /leaderboard`

**Query params:** `lat`, `lng`, `radius`, `period` (monthly | alltime)

```json
// Response 200
{
  "data": [
    {
      "rank": 1,
      "user": {
        "id": "uuid",
        "full_name": "Kavitha",
        "avatar_url": "https://...",
        "badge": "local_expert"
      },
      "recommendation_count": 42,
      "neighborhood": "Jayanagar 4th Block"
    }
  ]
}
```

---

## Referrals (MVP 5)

### `POST /referrals`

Create referral link for a merchant.

```json
// Request
{ "merchant_id": "uuid" }

// Response 201
{ "referral_code": "abc123", "share_url": "https://localstore.app/ref/abc123" }
```

### `GET /referrals/me`

```json
// Response 200
{ "data": [ /* Referral[] */ ] }
```

### `POST /referrals/convert`

Called on signup with referral code.

```json
// Request
{ "referral_code": "abc123" }

// Response 200
{ "reward": { "type": "discount", "value": 50.00 } }
```

---

## Voice Search (MVP 6)

### `POST /voice/search`

Multipart: `audio` (file, .wav/.m4a), `lat` (float), `lng` (float)

```json
// Response 200
{
  "transcript": "Diwali ke liye sweets chahiye",
  "detected_language": "hi",
  "intent": {
    "category": "Food",
    "area": null,
    "budget": null,
    "urgency": "normal"
  },
  "merchants": [ /* MerchantCard[] */ ],
  "tts_audio_url": "https://storage.../response.mp3"
}
```

---

## Festival Planner (MVP 6)

### `GET /festivals`

Upcoming festivals for user's region. Festival data is a hardcoded config (static JSON in backend), not a DB table.

```json
// Response 200
[
  {
    "name": "Diwali",
    "date": "2026-10-20",
    "days_away": 207,
    "categories": ["Food", "HomeServices", "Tailoring", "Beauty", "Events"]
  }
]
```

### `GET /users/me/festival-plans`

```json
// Response 200
[ /* FestivalPlan[] */ ]
```

### `POST /users/me/festival-plans`

```json
// Request
{
  "festival_name": "Diwali",
  "festival_date": "2026-10-20",
  "checklist": [
    { "item": "Sweets", "category": "Food", "status": "pending", "merchant_id": null },
    { "item": "Decorations", "category": "Events", "status": "pending", "merchant_id": null }
  ]
}

// Response 201 — FestivalPlan
```

### `PATCH /users/me/festival-plans/{id}`

Partial checklist update. Response 200.

### `DELETE /users/me/festival-plans/{id}`

Response 204.

---

## "I Need..." (MVP 6)

### `POST /need-posts`

Post a need — triggers push to nearby matching merchants.

```json
// Request
{
  "category": "Food",
  "description": "Need sweets for 50 people by Thursday",
  "lat": 12.9259,
  "lng": 77.5838,
  "radius_meters": 5000
}

// Response 201 — NeedPost
```

### `GET /need-posts/mine`

```json
// Response 200
[ /* NeedPost[] */ ]
```

### `PATCH /need-posts/{id}/close`

```json
// Response 200
{ "status": "closed" }
```

### `GET /need-posts/incoming`

Merchant-only: need posts within service radius matching their category.

```json
// Response 200
[
  {
    "id": "uuid",
    "category": "Food",
    "description": "Need sweets for 50 people by Thursday",
    "user": { "id": "uuid", "full_name": "Priya", "avatar_url": "https://..." },
    "distance_meters": 800,
    "expires_at": "2026-03-22T10:00:00Z"
  }
]
```

---

## Merchant Insights (MVP 6)

### `GET /merchants/me/insights`

```json
// Response 200
{
  "peak_inquiry_hour": 18,
  "peak_inquiry_day": 3,
  "monthly_revenue": { "2026-03": 12400, "2026-02": 9800 },
  "total_orders": 47,
  "conversion_rate": 68.5
}
```

---

## Storage

### `POST /storage/upload`

Multipart: `file` (binary), `bucket` (string), `path` (optional)

> **Bucket authorization rules (enforced server-side):**
>
> | Bucket | Who can upload |
> |--------|---------------|
> | `user-avatars` | own user only (`user_id` in path must match auth user) |
> | `merchant-avatars` | merchant owner only |
> | `portfolio-images` | merchant owner only |
> | `post-media` | merchant owner only |
> | `chat-attachments` | thread participants only |
> | `video-intros` | merchant owner only (MVP 6) |
> | `voice-uploads` | own user only; auto-deleted after processing (MVP 6) |
>
> Requests to unlisted buckets or mismatched ownership return **403**.

```json
// Response 200
{ "path": "merchant-avatars/uuid/avatar.jpg", "url": "https://..." }
```

### `GET /storage/download/{bucket}/{path}`

> **Public vs signed URLs**: Public buckets (`user-avatars`, `merchant-avatars`, `portfolio-images`, `post-media`, `video-intros`) return unsigned public URLs — these are CDN-cacheable. Private buckets (`chat-attachments`, `voice-uploads`) return signed URLs with 1-hour expiry.

```json
// Response 200 (public bucket)
{ "url": "https://your-project.supabase.co/storage/v1/object/public/portfolio-images/uuid/photo.jpg" }

// Response 200 (private bucket)
{ "url": "https://signed-url...", "expires_in": 3600 }
```

### `DELETE /storage/delete/{bucket}/{path}`

Response 204.

---

## Health

### `GET /health`

No auth required.

```json
// Response 200
{ "status": "ok" }
```

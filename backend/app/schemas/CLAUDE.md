# schemas/
Pydantic request/response models for all LocalStore API endpoints — no business logic, no DB access. One file per route file + `common.py` for shared types.

- `common.py` — shared pagination and response types
  - exports: `CursorParams { limit: int = 20, before: str | None }`, `PaginatedResponse { data: list, has_more: bool, next_cursor: str | None }`
  - used by: all list endpoints (feed, merchants, reviews, orders, chats, etc.)

- `auth.py` — phone OTP auth models
  - exports: `OTPRequest { phone }` (E.164 validated), `OTPVerifyRequest { phone, token }`, `RefreshRequest { refresh_token }`, `AuthResponse { access_token, refresh_token, token_type, expires_in, user: dict }`

- `users.py` — user profile models (replaces profile.py)
  - exports: `UserProfile`, `UserUpdate`, `PushTokenRequest { token: str, min_length=1 }`

- `merchants.py` — merchant CRUD models
  - exports: `MerchantCreate { name, category, lat, lng, phone, whatsapp, ... }`, `MerchantUpdate` (all optional), `MerchantDetail`, `MerchantCard` (summary for lists), `mask_phone()`
  - gotcha: `MerchantDetail.phone` and `.whatsapp` auto-masked via `model_validator` — `"*****3210"` format
  - gotcha: pass `is_owner=True` when constructing `MerchantDetail` for `/me` endpoint to bypass masking

- `services.py` — service catalog models (NOT the business logic layer)
  - exports: `ServiceCreate { name, price, description?, duration_minutes? }`, `ServiceUpdate` (all optional), `ServiceResponse`
  - gotcha: `price` is `Decimal` (maps to NUMERIC(10,2) in DB) — not float; JSON serialization uses str representation

- `portfolio.py` — portfolio image models
  - exports: `PortfolioImageCreate { image_url, caption? }`, `PortfolioImageResponse { id, merchant_id, image_url, caption, sort_order, created_at }`, `ReorderRequest { image_ids: list[str] }`
  - gotcha: max 10 images per merchant enforced at route level, not schema level

- `feed.py` — feed response models (MVP 1)
  - exports: `NearbyFeedItem { id, type, merchant_id, distance_meters, lat, lng, ... }`, `NearbyFeedResponse { data: list[NearbyFeedItem], has_more, next_cursor }`

- `search.py` — search response models (MVP 1)
  - exports: `SearchMerchantItem { id, name, category, lat, lng, ... }`, `SearchServiceItem { id, name, merchant_name, category, ... }`, `SearchResponse { merchants: list[SearchMerchantItem], services: list[SearchServiceItem] }`

- `follows.py` — `FollowResponse { merchant_id, followed_at }`

- `reviews.py` — `ReviewCreate { rating: int, text }`, `ReviewResponse`

- `posts.py` — `PostCreate { text, service_id? }`, `PostResponse`

- `likes.py` — `LikeResponse`

- `comments.py` — `CommentCreate { text }`, `CommentResponse`

- `chat.py` — 7 Pydantic models for threads + messages (MVP 3)
  - exports: `ThreadResponse`, `MessageCreate { content }`, `MessageResponse`, `ThreadCreateRequest { merchant_id }`, `ThreadListResponse`, `MessageListResponse`, `MarkReadRequest { read_by_user, read_by_merchant }`
  - gotcha: `read_by_user` / `read_by_merchant` field names (not `is_read`); boolean toggles per-role read status

- `orders.py` — `OrderCreate { service_id, notes }`, `OrderResponse`, `StatusUpdate { status }`
  - gotcha: `OrderCreate` has NO `merchant_id` field — always derived server-side

- `payments.py` — `PaymentVerify`, `WebhookPayload`, `RefundRequest`

- `recommendations.py` — `RecommendationCreate { text }`, `RecommendationResponse`

- `referrals.py` — `ReferralResponse`

- `leaderboard.py` — `LeaderboardEntry { user_id, full_name, recommendation_count, badge }`

- `voice.py` — `VoiceSearchResponse { results, tts_url, transcript }`

- `festivals.py` — `FestivalPlan`, `ChecklistItem`

- `need_posts.py` — `NeedPostCreate { category, description, lat, lng }`, `NeedPostResponse`

- `storage.py` — `UploadResponse { path, url }`, `DownloadResponse { url, expires_in? }`

## Key Patterns
- `*Create` / `*Update` suffix: inbound payloads (client-supplied fields)
- `*Response` / `*Detail` / `*Card` suffix: outbound payloads (includes server-generated fields)
- No ORM integration — plain `BaseModel`, no `model_config` with `from_attributes`
- All list endpoints use `PaginatedResponse` from `common.py`

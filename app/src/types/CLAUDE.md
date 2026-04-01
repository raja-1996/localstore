# types
TypeScript interfaces and type unions for domains (feed, merchants, etc.).

- `feed.ts` — Nearby feed types
  - exports: `MerchantCategory` (type union: "food" | "beauty" | "tailoring" | etc.), `NearbyFeedItem`, `NearbyFeedResponse`
  - types:
    - `MerchantCategory` — type union of all merchant categories
    - `NearbyFeedItem { id, name, distance_meters, avatar_url, category, rating, price_range, merchant_id }`
    - `NearbyFeedResponse { items: NearbyFeedItem[], nextCursor }`

- `merchant.ts` — Merchant detail types
  - exports: `MerchantDetail`, `ServiceResponse`, `PortfolioImage`
  - types:
    - `MerchantDetail { id, name, avatar_url, category, rating, phone, whatsapp, address, description }`
    - `ServiceResponse { id, name, description, price }`
    - `PortfolioImage { id, url, order }`

- `search.ts` — Search result types
  - exports: `SearchMerchant`, `SearchService`, `SearchResult`
  - types: `SearchMerchant`, `SearchService` (name, location, rating), `SearchResult { merchants, services }`

- `user.ts` — User profile types
  - exports: `UserProfile`, `UserPreferences`
  - types: `UserProfile { id, phone, email, avatar_url, badge }`, `UserPreferences { saved_merchants[], searches[] }`

- `chat.ts` — Chat messaging types
  - exports: `MerchantStub`, `ChatThread`, `ChatThreadListResponse`, `ChatMessage`, `ChatMessageListResponse`, `MarkReadResponse`
  - types:
    - `MerchantStub { id, name, avatar_url }`
    - `ChatThread { id, user_id, merchant_id, merchant, last_message, last_message_at, unread_count, created_at }`
    - `ChatMessage { id, thread_id, sender_id, content, read_by_user, read_by_merchant, created_at }`
    - paginated responses: `ChatThreadListResponse`, `ChatMessageListResponse { data[], has_more, next_cursor }`

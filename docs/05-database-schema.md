# LocalStore — Database Schema

## Extensions

```sql
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```

All tables use RLS. Backend connects with user-scoped JWT so RLS policies are enforced server-side.

---

## Tables

### `profiles` (MVP 1)

Extends `auth.users`. Auto-created via trigger on signup.

```sql
CREATE TABLE profiles (
  id                   UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  phone                TEXT UNIQUE,
  email                TEXT,
  full_name            TEXT,
  avatar_url           TEXT,
  is_merchant          BOOLEAN DEFAULT false,
  push_token           TEXT,                          -- MVP 3: Expo push token
  language             TEXT DEFAULT 'en',             -- MVP 6: preferred language
  badge                TEXT,                          -- MVP 5: NULL | 'local_expert' | 'top_recommender'
  recommendation_count INT DEFAULT 0,                 -- MVP 5: denormalized
  created_at           TIMESTAMPTZ DEFAULT now(),
  updated_at           TIMESTAMPTZ DEFAULT now()
);
```

**RLS:**
- SELECT: any authenticated user
- UPDATE: own row only (`auth.uid() = id`)

**Indexes:**
```sql
CREATE INDEX idx_profiles_phone ON profiles(phone);
CREATE INDEX idx_profiles_name_trgm ON profiles USING GIN (full_name gin_trgm_ops);
```

---

### `merchants` (MVP 1)

Core merchant profile with PostGIS location and full-text search.

```sql
CREATE TABLE merchants (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID UNIQUE NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name                  TEXT NOT NULL,
  description           TEXT,
  category              TEXT NOT NULL CHECK (category IN (
                          'Food', 'Tailoring', 'Beauty', 'HomeServices', 'Events', 'Other'
                        )),
  tags                  TEXT[],                        -- sub-categories for filtering
  location              GEOGRAPHY(POINT, 4326) NOT NULL,
  address_text          TEXT,                          -- human-readable address
  neighborhood          TEXT,                          -- colony/area name
  service_radius_meters INT DEFAULT 5000,
  phone                 TEXT,
  whatsapp              TEXT,
  avg_rating            NUMERIC(3,2) DEFAULT 0,        -- denormalized from reviews
  review_count          INT DEFAULT 0,                 -- denormalized from reviews
  follower_count        INT DEFAULT 0,                 -- denormalized from follows
  response_time_minutes INT,                           -- updated by background job
  is_verified           BOOLEAN DEFAULT false,
  is_active             BOOLEAN DEFAULT true,
  video_intro_url       TEXT,                          -- MVP 6
  search_vector         TSVECTOR,                      -- auto-updated by trigger
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now()
);
```

**RLS:**
- SELECT: any user (public browsing via anon key)
- INSERT: authenticated, `user_id = auth.uid()`
- UPDATE/DELETE: own merchant only (`user_id = auth.uid()`)

**Indexes:**
```sql
CREATE INDEX idx_merchants_location ON merchants USING GIST (location);
CREATE INDEX idx_merchants_category ON merchants(category);
CREATE INDEX idx_merchants_search ON merchants USING GIN (search_vector);
CREATE INDEX idx_merchants_active ON merchants(is_active);
CREATE INDEX idx_merchants_name_trgm ON merchants USING GIN (name gin_trgm_ops);
```

**Trigger — search vector:**
```sql
CREATE OR REPLACE FUNCTION update_merchant_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := to_tsvector('simple',
    coalesce(NEW.name, '') || ' ' ||
    coalesce(NEW.description, '') || ' ' ||
    coalesce(array_to_string(NEW.tags, ' '), '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_merchant_search_vector
  BEFORE INSERT OR UPDATE ON merchants
  FOR EACH ROW EXECUTE FUNCTION update_merchant_search_vector();

-- Note: tsvector ('simple' dictionary) handles Latin/English terms.
-- For non-Latin scripts (Hindi, Tamil, Kannada), pg_trgm trigram
-- similarity (idx_merchants_name_trgm) is the primary search method.
```

---

### `services` (MVP 1)

Merchant service catalog items.

```sql
CREATE TABLE services (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id          UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  name                 TEXT NOT NULL,
  description          TEXT,
  price                NUMERIC(10,2),
  price_unit           TEXT,                           -- 'per item', 'per hour', 'per kg'
  image_url            TEXT,
  is_available         BOOLEAN DEFAULT true,
  cancellation_policy  TEXT,                           -- MVP 4
  advance_percent      INT DEFAULT 20,                 -- MVP 4: % advance required
  created_at           TIMESTAMPTZ DEFAULT now(),
  updated_at           TIMESTAMPTZ DEFAULT now()
);
```

**RLS:**
- SELECT: any user
- INSERT/UPDATE/DELETE: merchant owner (`merchant_id` → `merchants.user_id = auth.uid()`)

**Indexes:**
```sql
CREATE INDEX idx_services_merchant ON services(merchant_id);
CREATE INDEX idx_services_available ON services(merchant_id, is_available);
```

---

### `portfolio_images` (MVP 1)

Merchant work portfolio (3-10 images).

```sql
CREATE TABLE portfolio_images (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id  UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  image_url    TEXT NOT NULL,
  caption      TEXT,
  order_id     UUID,                                   -- MVP 5: verified work photo; FK to orders added in migration 007 via ALTER TABLE
  sort_order   INT DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT now()
);
```

**RLS:**
- SELECT: any user
- INSERT/UPDATE/DELETE: merchant owner only

**Indexes:**
```sql
CREATE INDEX idx_portfolio_merchant ON portfolio_images(merchant_id);
```

---

### `follows` (MVP 2)

User-to-merchant follow relationships.

```sql
CREATE TABLE follows (
  follower_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  merchant_id  UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (follower_id, merchant_id)
);
```

**RLS:**
- SELECT: any authenticated user
- INSERT: `follower_id = auth.uid()`
- DELETE: `follower_id = auth.uid()`

**Triggers:**
```sql
-- After INSERT: increment merchants.follower_count
-- After DELETE: decrement merchants.follower_count
CREATE OR REPLACE FUNCTION update_follower_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE merchants SET follower_count = follower_count + 1 WHERE id = NEW.merchant_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE merchants SET follower_count = GREATEST(0, follower_count - 1) WHERE id = OLD.merchant_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_follower_count
  AFTER INSERT OR DELETE ON follows
  FOR EACH ROW EXECUTE FUNCTION update_follower_count();
```

**Indexes:**
```sql
CREATE INDEX idx_follows_merchant ON follows(merchant_id);
CREATE INDEX idx_follows_follower ON follows(follower_id);
```

---

### `reviews` (MVP 2)

Ratings and text reviews on merchants.

```sql
CREATE TABLE reviews (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id           UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  reviewer_id           UUID NOT NULL REFERENCES profiles(id),
  rating                SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  text                  TEXT,
  order_id              UUID,                          -- MVP 5: verified purchase; FK to orders added in migration 007 via ALTER TABLE
  is_verified_purchase  BOOLEAN DEFAULT false,
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now(),
  UNIQUE (merchant_id, reviewer_id)                    -- one review per user per merchant
);
```

**RLS:**
- SELECT: any user
- INSERT: authenticated, `reviewer_id = auth.uid()`, and reviewer must not be the merchant owner

```sql
CREATE POLICY "reviews_insert" ON reviews
  FOR INSERT WITH CHECK (
    reviewer_id = auth.uid()
    AND NOT EXISTS (
      SELECT 1 FROM merchants
       WHERE id = reviews.merchant_id
         AND user_id = auth.uid()
    )
  );
```
- UPDATE/DELETE: own review only

**Trigger — recalculate merchant rating:**
```sql
CREATE OR REPLACE FUNCTION update_merchant_rating()
RETURNS TRIGGER AS $$
DECLARE
  target_id UUID;
  v_avg     NUMERIC(3,2);
  v_count   INT;
BEGIN
  target_id := COALESCE(NEW.merchant_id, OLD.merchant_id);
  SELECT COALESCE(AVG(rating), 0), COUNT(*)
    INTO v_avg, v_count
    FROM reviews
   WHERE merchant_id = target_id;
  UPDATE merchants SET
    avg_rating   = v_avg,
    review_count = v_count
  WHERE id = target_id;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_merchant_rating
  AFTER INSERT OR UPDATE OR DELETE ON reviews
  FOR EACH ROW EXECUTE FUNCTION update_merchant_rating();
```

**Indexes:**
```sql
CREATE INDEX idx_reviews_merchant ON reviews(merchant_id);
CREATE INDEX idx_reviews_reviewer ON reviews(reviewer_id);
```

---

### `posts` (MVP 3)

Merchant service posts with optional service card attachment.

```sql
CREATE TABLE posts (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id    UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  content        TEXT,
  image_url      TEXT,
  service_id     UUID REFERENCES services(id),         -- optional service card
  post_type      TEXT DEFAULT 'update' CHECK (post_type IN ('update', 'offer', 'before_after')), -- 'before_after' is future MVP
  like_count     INT DEFAULT 0,                        -- denormalized
  comment_count  INT DEFAULT 0,                        -- denormalized
  is_active      BOOLEAN DEFAULT true,
  created_at     TIMESTAMPTZ DEFAULT now(),
  updated_at     TIMESTAMPTZ DEFAULT now()
);
```

**RLS:**
- SELECT: any user
- INSERT/UPDATE/DELETE: merchant owner only

**Realtime:** enabled for live feed updates.

**Indexes:**
```sql
CREATE INDEX idx_posts_merchant_created ON posts(merchant_id, created_at DESC);
CREATE INDEX idx_posts_created ON posts(created_at DESC);
CREATE INDEX idx_posts_active ON posts(is_active);
```

---

### `likes` (MVP 2)

User likes on posts.

```sql
CREATE TABLE likes (
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  post_id    UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, post_id)
);
```

**RLS:**
- SELECT: any user
- INSERT: `user_id = auth.uid()`
- DELETE: `user_id = auth.uid()`

**Triggers:**
```sql
CREATE OR REPLACE FUNCTION update_like_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE posts SET like_count = like_count + 1 WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE posts SET like_count = GREATEST(0, like_count - 1) WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_like_count
  AFTER INSERT OR DELETE ON likes
  FOR EACH ROW EXECUTE FUNCTION update_like_count();
```

---

### `comments` (MVP 2)

Flat comments on posts.

```sql
CREATE TABLE comments (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id    UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES profiles(id),
  content    TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

**RLS:**
- SELECT: any user
- INSERT: authenticated, `user_id = auth.uid()`
- UPDATE/DELETE: own comment only

**Triggers:**
```sql
CREATE OR REPLACE FUNCTION update_comment_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE posts SET comment_count = comment_count + 1 WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE posts SET comment_count = GREATEST(0, comment_count - 1) WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_comment_count
  AFTER INSERT OR DELETE ON comments
  FOR EACH ROW EXECUTE FUNCTION update_comment_count();
```

**Indexes:**
```sql
CREATE INDEX idx_comments_post_created ON comments(post_id, created_at);
```

---

### `chat_threads` (MVP 3)

1:1 conversation between user and merchant.

```sql
CREATE TABLE chat_threads (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  merchant_id           UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  last_message_at       TIMESTAMPTZ,
  unread_user_count     INT DEFAULT 0,
  unread_merchant_count INT DEFAULT 0,
  created_at            TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, merchant_id)
);
```

**RLS:**
- SELECT: participants only (`auth.uid() = user_id` OR `auth.uid()` owns the merchant)
- INSERT: `user_id = auth.uid()`

**Indexes:**
```sql
CREATE INDEX idx_threads_user_last ON chat_threads(user_id, last_message_at DESC);
CREATE INDEX idx_threads_merchant_last ON chat_threads(merchant_id, last_message_at DESC);
```

---

### `chat_messages` (MVP 3)

Messages within a chat thread.

```sql
CREATE TABLE chat_messages (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id  UUID NOT NULL REFERENCES chat_threads(id) ON DELETE CASCADE,
  sender_id  UUID NOT NULL REFERENCES profiles(id),
  content    TEXT NOT NULL,
  read_by_user     BOOLEAN DEFAULT false,   -- true once the customer has seen it
  read_by_merchant BOOLEAN DEFAULT false,   -- true once the merchant has seen it
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**RLS:**
- SELECT: thread participants only
- INSERT: thread participant, `sender_id = auth.uid()`

```sql
CREATE OR REPLACE FUNCTION is_chat_participant(p_thread_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM chat_threads ct
    JOIN merchants m ON ct.merchant_id = m.id
    WHERE ct.id = p_thread_id
      AND (ct.user_id = auth.uid() OR m.user_id = auth.uid())
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE POLICY "chat_messages_select" ON chat_messages
  FOR SELECT USING (is_chat_participant(thread_id));

CREATE POLICY "chat_messages_insert" ON chat_messages
  FOR INSERT WITH CHECK (
    sender_id = auth.uid() AND is_chat_participant(thread_id)
  );
```

**Realtime:** enabled for live chat.

**Trigger:** After INSERT → update `chat_threads.last_message_at`, increment unread counter.

**Indexes:**
```sql
CREATE INDEX idx_chat_messages_thread_created ON chat_messages(thread_id, created_at);
```

---

### `orders` (MVP 4)

Service orders with Razorpay payment.

```sql
CREATE TABLE orders (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                     UUID NOT NULL REFERENCES profiles(id),
  merchant_id                 UUID NOT NULL REFERENCES merchants(id),
  service_id                  UUID NOT NULL REFERENCES services(id),
  status                      TEXT DEFAULT 'pending_payment' CHECK (status IN (
                                'pending_payment', 'confirmed', 'in_progress',
                                'ready', 'delivered', 'cancelled', 'refunded'
                              )),
  quantity                    INT DEFAULT 1,
  total_amount                NUMERIC(10,2) NOT NULL,
  advance_amount              NUMERIC(10,2) NOT NULL,
  balance_amount              NUMERIC(10,2) GENERATED ALWAYS AS (total_amount - advance_amount) STORED,
  requirements_text           TEXT,                     -- customer's requirements
  requirements_image_url      TEXT,                     -- "stitch like this" photo
  razorpay_order_id           TEXT,
  razorpay_payment_id         TEXT,
  refund_id                   TEXT,
  scheduled_at                TIMESTAMPTZ,              -- optional: requested service date/time
  cancellation_policy_snapshot TEXT,                    -- snapshot at order time
  created_at                  TIMESTAMPTZ DEFAULT now(),
  updated_at                  TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT chk_advance_lte_total CHECK (advance_amount <= total_amount)
);
```

**RLS:**
- SELECT: `user_id = auth.uid()` OR merchant owns `merchant_id`
- INSERT: `user_id = auth.uid()`
- UPDATE: merchant can update status; user can cancel if status IN ('pending_payment', 'confirmed')

**Realtime:** enabled for order status updates.

**Indexes:**
```sql
CREATE INDEX idx_orders_user_created ON orders(user_id, created_at DESC);
CREATE INDEX idx_orders_merchant_status ON orders(merchant_id, status);
```

---

### `payment_events` (MVP 4)

Razorpay webhook audit log. Internal only.

```sql
CREATE TABLE payment_events (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id          UUID REFERENCES orders(id),
  event_type        TEXT NOT NULL,                     -- payment.captured, refund.created
  razorpay_event_id TEXT UNIQUE,
  payload           JSONB,
  processed_at      TIMESTAMPTZ DEFAULT now()
);
```

**RLS:**
- SELECT/INSERT: service role only (no user access)

```sql
ALTER TABLE payment_events ENABLE ROW LEVEL SECURITY;
-- No user-facing policies. Service role bypasses RLS automatically.
-- Do NOT add SELECT/INSERT policies here; that would expose payment data to users.
```

**Indexes:**
```sql
CREATE INDEX idx_payment_events_order ON payment_events(order_id);
```

---

### `recommendations` (MVP 5)

User recommendations for merchants.

```sql
CREATE TABLE recommendations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recommender_id  UUID NOT NULL REFERENCES profiles(id),
  merchant_id     UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  text            TEXT NOT NULL,
  order_id        UUID REFERENCES orders(id),          -- verified purchase tag
  is_verified     BOOLEAN DEFAULT false,
  share_count     INT DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE (recommender_id, merchant_id)
);
```

**RLS:**
- SELECT: any user
- INSERT: authenticated, one per merchant per user
- UPDATE/DELETE: own recommendation only

**Indexes:**
```sql
CREATE INDEX idx_recommendations_merchant ON recommendations(merchant_id);
CREATE INDEX idx_recommendations_recommender ON recommendations(recommender_id);
```

**Trigger — auto-increment profiles.recommendation_count:**
```sql
CREATE OR REPLACE FUNCTION update_recommendation_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE profiles SET recommendation_count = recommendation_count + 1 WHERE id = NEW.recommender_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE profiles SET recommendation_count = GREATEST(0, recommendation_count - 1) WHERE id = OLD.recommender_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_recommendation_count
  AFTER INSERT OR DELETE ON recommendations
  FOR EACH ROW EXECUTE FUNCTION update_recommendation_count();
```

---

### `referrals` (MVP 5)

Referral tracking for growth.

```sql
CREATE TABLE referrals (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id      UUID NOT NULL REFERENCES profiles(id),
  referred_user_id UUID REFERENCES profiles(id),       -- set on signup
  merchant_id      UUID NOT NULL REFERENCES merchants(id),
  referral_code    TEXT UNIQUE NOT NULL,
  status           TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'converted', 'rewarded')),
  reward_type      TEXT,                               -- 'discount', 'credit'
  reward_value     NUMERIC(10,2),
  created_at       TIMESTAMPTZ DEFAULT now(),
  converted_at     TIMESTAMPTZ
);
```

**RLS:**
- SELECT: referrer sees own referrals (`referrer_id = auth.uid()`)
- INSERT: authenticated

---

### `voice_requests` (MVP 6)

Voice search log for analytics and improvement.

```sql
CREATE TABLE voice_requests (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES profiles(id),
  audio_path          TEXT,                            -- Supabase Storage path
  transcript          TEXT,
  detected_language   TEXT,
  extracted_intent    JSONB,                           -- {category, area, budget, urgency}
  result_merchant_ids UUID[],
  created_at          TIMESTAMPTZ DEFAULT now()
);
```

**RLS:**
- SELECT/INSERT: own rows only (`user_id = auth.uid()`)

**Indexes:**
```sql
CREATE INDEX idx_voice_requests_user ON voice_requests(user_id);
```

---

### `festival_plans` (MVP 6)

User festival planning checklists.

```sql
CREATE TABLE festival_plans (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES profiles(id),
  festival_name TEXT NOT NULL,
  festival_date DATE,
  checklist     JSONB,                                -- [{item, category, status, merchant_id}]
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);
```

**RLS:**
- SELECT/INSERT/UPDATE/DELETE: own rows only

**Indexes:**
```sql
CREATE INDEX idx_festival_plans_user ON festival_plans(user_id);
```

---

### `need_posts` (MVP 6)

"I Need..." requests broadcast to nearby merchants.

```sql
CREATE TABLE need_posts (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES profiles(id),
  category       TEXT NOT NULL,
  description    TEXT,
  location       GEOGRAPHY(POINT, 4326),
  radius_meters  INT DEFAULT 5000,
  status         TEXT DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  expires_at     TIMESTAMPTZ,                         -- auto 48h after creation; filter with expires_at > now() in queries
  created_at     TIMESTAMPTZ DEFAULT now()
);
```

**RLS:**
- SELECT: any authenticated merchant (proximity filtered by PostGIS in query, not RLS). RLS enforces auth only.
- INSERT: `user_id = auth.uid()`
- UPDATE: own post only

**Indexes:**
```sql
CREATE INDEX idx_need_posts_location ON need_posts USING GIST (location);
CREATE INDEX idx_need_posts_expires ON need_posts(expires_at);
```

---

### `merchant_insights` (MVP 6)

Aggregated analytics for merchants. Computed by background job.

```sql
CREATE TABLE merchant_insights (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id       UUID UNIQUE NOT NULL REFERENCES merchants(id),
  peak_inquiry_hour SMALLINT,                          -- 0-23
  peak_inquiry_day  SMALLINT,                          -- 0=Sun, 6=Sat
  monthly_revenue   JSONB,                             -- {"2026-03": 12400, ...}
  total_orders      INT DEFAULT 0,
  conversion_rate   NUMERIC(5,2),
  updated_at        TIMESTAMPTZ DEFAULT now()
);
```

**RLS:**
- SELECT: merchant owner only
- INSERT/UPDATE: service role only

---

## Triggers Summary

| Trigger | Table | Action |
|---------|-------|--------|
| `auto_updated_at` | all tables with `updated_at` | BEFORE UPDATE: set `updated_at = now()` |
| `auto_create_profile` | `auth.users` | AFTER INSERT: create `profiles` row |
| `update_search_vector` | `merchants` | BEFORE INSERT/UPDATE: rebuild tsvector |
| `update_merchant_rating` | `reviews` | AFTER INSERT/UPDATE/DELETE: recalc `avg_rating`, `review_count` |
| `update_follower_count` | `follows` | AFTER INSERT/DELETE: ±1 `merchants.follower_count` |
| `update_like_count` | `likes` | AFTER INSERT/DELETE: ±1 `posts.like_count` |
| `update_comment_count` | `comments` | AFTER INSERT/DELETE: ±1 `posts.comment_count` |
| `update_thread_last_msg` | `chat_messages` | AFTER INSERT: update `last_message_at` + unread |
| `update_recommendation_count` | `recommendations` | AFTER INSERT/DELETE: ±1 `profiles.recommendation_count` |
| `promote_badge` | `profiles` | AFTER UPDATE on `recommendation_count`: set badge tier |

---

## Realtime Config

| Table | Purpose |
|-------|---------|
| `chat_messages` | Live 1:1 chat |
| `orders` | Order status updates |
| `posts` | Feed updates for followers |

---

## Migration Order

```
001_extensions.sql          → postgis, pg_trgm, uuid-ossp
002_profiles.sql            → profiles table + auto-create trigger
003_merchants.sql           → merchants table + search vector trigger
004_services_portfolio.sql  → services + portfolio_images
005_social.sql              → follows, reviews, posts, likes, comments + all triggers
006_chat.sql                → chat_threads + chat_messages + Realtime
007_orders.sql              → orders + payment_events + Realtime + ALTER TABLE for portfolio_images.order_id and reviews.order_id FKs
008_recommendations.sql     → recommendations + referrals
009_intelligence.sql        → voice_requests, festival_plans, need_posts, merchant_insights
```

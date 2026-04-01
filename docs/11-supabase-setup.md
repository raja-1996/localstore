# LocalStore — Supabase Setup Guide

Complete checklist for setting up a new Supabase project for LocalStore.

---

## 1. Create a New Supabase Project

1. Go to [supabase.com](https://supabase.com) → New Project
2. **Region: Select South Asia (Mumbai) `ap-south-1`** — critical for Indian user latency (20–50ms vs 200ms+ from US)
3. Note your **Project Reference ID** (visible in the project URL)
4. From **Project Settings → API**, copy:
   - `Project URL` → `SUPABASE_URL`
   - `anon public` key → `SUPABASE_PUBLISHABLE_DEFAULT_KEY`
   - `service_role` key → `SUPABASE_SECRET_DEFAULT_KEY`

> **Environment isolation**: Create separate Supabase projects for dev, staging, and prod. Never share a project across environments.

---

## 2. Configure Local Credentials

Create `backend/.env.test` (already in `.gitignore` — never commit):

```
SUPABASE_URL=https://<your-ref>.supabase.co
SUPABASE_PUBLISHABLE_DEFAULT_KEY=<anon-key>
SUPABASE_SECRET_DEFAULT_KEY=<service-role-key>
```

Also create `backend/.env` for running the server locally (same Supabase values, plus additional keys):

```
SUPABASE_URL=https://<your-ref>.supabase.co
SUPABASE_PUBLISHABLE_DEFAULT_KEY=<anon-key>
SUPABASE_SECRET_DEFAULT_KEY=<service-role-key>
RAZORPAY_KEY_ID=<razorpay-key-id>           # MVP 4+
RAZORPAY_KEY_SECRET=<razorpay-key-secret>   # MVP 4+
RAZORPAY_WEBHOOK_SECRET=<webhook-secret>    # MVP 4+
```

See `docs/07-setup-guide.md` for the full env var reference.

---

## 3. Link the Supabase CLI

From the project root:

```bash
npx supabase login          # one-time browser auth
npx supabase link --project-ref <your-ref>
```

Verify it worked:

```bash
npx supabase projects list  # should show your project with ● (linked)
```

---

## 4. Push All Migrations

```bash
npx supabase db push
```

This applies all files in `supabase/migrations/` in order:

| File | What it creates |
|------|----------------|
| `001_extensions.sql` | PostGIS, pg_trgm, uuid-ossp extensions |
| `002_profiles.sql` | `profiles` table, auto-create trigger on `auth.users`, RLS, indexes |
| `003_merchants.sql` | `merchants` table, PostGIS GIST index, search vector trigger, RLS |
| `004_services_portfolio.sql` | `services` + `portfolio_images` tables, RLS, indexes |
| `005_social.sql` | `follows`, `reviews`, `posts`, `likes`, `comments` + all denormalized count triggers |
| `006_chat.sql` | `chat_threads` + `chat_messages`, Realtime enabled, unread indicator triggers |
| `007_orders.sql` | `orders` + `payment_events`, state CHECK constraints, Realtime enabled, ALTER TABLE for `portfolio_images.order_id` and `reviews.order_id` FKs |
| `008_recommendations.sql` | `recommendations` + `referrals`, badge promotion trigger |
| `009_intelligence.sql` | `voice_requests`, `festival_plans`, `need_posts`, `merchant_insights` |

**Expected output:**
```
Applying migration 001_extensions.sql...
Applying migration 002_profiles.sql...
Applying migration 003_merchants.sql...
Applying migration 004_services_portfolio.sql...
Applying migration 005_social.sql...
Applying migration 006_chat.sql...
Applying migration 007_orders.sql...
Applying migration 008_recommendations.sql...
Applying migration 009_intelligence.sql...
Finished supabase db push.
```

---

## 5. Supabase Dashboard Settings

### 5a. Enable Phone OTP Provider

LocalStore uses phone number as primary identity.

1. Dashboard → **Authentication → Providers → Phone**
2. Toggle **Enable Phone provider** → **ON**
3. Select SMS provider:
   - **Twilio**: Enter Account SID, Auth Token, Messaging Service SID
   - **MSG91**: Enter Auth Key, Template ID, Sender ID
4. Save

> **Local dev**: The local Supabase stack uses a fake SMS provider — OTP codes appear in Studio logs. No Twilio/MSG91 needed locally.

### 5b. Disable Email Confirmation (required for integration tests)

Tests sign up users and immediately log in. If email confirmation is enabled, login fails.

1. Dashboard → **Authentication → Providers → Email**
2. Toggle **Confirm email** → **OFF**
3. Save

### 5c. Verify Storage Buckets

After `db push`, the following buckets are created automatically by the migrations:

| Bucket | Access | Created by |
|--------|--------|------------|
| `user-avatars` | Public | `002_profiles.sql` |
| `merchant-avatars` | Public | `003_merchants.sql` |
| `portfolio-images` | Public | `004_services_portfolio.sql` |
| `post-media` | Public | `005_social.sql` |
| `chat-attachments` | Private | `006_chat.sql` |
| `video-intros` | Public | `009_intelligence.sql` |
| `voice-uploads` | Private | `009_intelligence.sql` |

Verify: Dashboard → **Storage** → you should see all 7 buckets.

If any are missing, re-run the migration or create manually with the correct access level.

### 5d. Verify Realtime Enabled

Dashboard → **Database → Replication** → ensure these tables have Realtime enabled:
- `chat_messages`
- `orders`
- `posts`

---

## 6. What the Migrations Create

### Extensions

| Extension | Purpose |
|-----------|---------|
| `postgis` | Geographic queries: `GEOGRAPHY(POINT, 4326)`, `ST_DWithin`, `ST_Distance` |
| `pg_trgm` | Fuzzy text search: `gin_trgm_ops` indexes for typo-tolerant search |
| `uuid-ossp` | `gen_random_uuid()` for primary keys |

### Tables & RLS Summary

| Table | RLS SELECT | RLS INSERT | RLS UPDATE | RLS DELETE |
|-------|-----------|-----------|-----------|-----------|
| `profiles` | Any authenticated | — (auto-created) | Own row only | — |
| `merchants` | Any user (public) | Own `user_id` | Own merchant | Own merchant |
| `services` | Any user | Merchant owner | Merchant owner | Merchant owner |
| `portfolio_images` | Any user | Merchant owner | Merchant owner | Merchant owner |
| `follows` | Own follows | Authenticated | — | Own follow |
| `reviews` | Any user | Authenticated (not self-review) | Own review | Own review |
| `posts` | Any user | Merchant owner | Merchant owner | Merchant owner |
| `likes` | Any user | Authenticated | — | Own like |
| `comments` | Any user | Authenticated | Own comment | Own comment |
| `chat_threads` | Participant only | Authenticated | Participant only | — |
| `chat_messages` | Thread participant | Thread participant | — | — |
| `orders` | Own orders | Authenticated | Status updates by role | — |
| `payment_events` | **None** (service role only) | **Service role only** | — | — |
| `recommendations` | Any user | Authenticated | Own rec | Own rec |
| `referrals` | Own referrals | Authenticated | Conversion update | — |
| `need_posts` | Any authenticated merchant | Own post | Own post | Own post |
| `merchant_insights` | Merchant owner | Service role only | Service role only | — |

> **`payment_events` RLS**: This table has RLS **enabled** but **no user-facing policies**. Only the service-role client can read/write. This is intentional — payment data must never be exposed via the anon key. If you see RLS errors on payment writes, ensure the backend uses `get_supabase()` (service role), not `get_user_supabase()`.

### Storage RLS Policies

All storage buckets enforce path-based ownership:

- **INSERT**: Users can only upload to `{user_id}/...` paths within their allowed buckets
- **SELECT (public buckets)**: Anyone can read
- **SELECT (private buckets)**: Owner only (backend generates signed URLs)
- **DELETE**: Owner only

> **Storage RLS DELETE gotcha**: Supabase Storage's `remove()` returns 204 even when RLS blocks the delete. The file is NOT actually deleted — SQL `DELETE 0 rows` is not an error. Tests verify the file still exists afterward, not the HTTP status code.

### Triggers

| Trigger | Table | Action |
|---------|-------|--------|
| `auto_updated_at` | All tables with `updated_at` | BEFORE UPDATE: set `updated_at = now()` |
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

## 7. Running Tests

### Unit tests (no Supabase needed)

```bash
cd backend
uv run pytest tests/ --ignore=tests/integration/ -v
```

Uses mocked Supabase — runs offline.

### Integration tests (requires live Supabase + `.env.test`)

```bash
cd backend
uv run pytest tests/integration/ -v
```

Auto-skips if Supabase is unreachable or `.env.test` is missing.

### All tests

```bash
cd backend
uv run pytest tests/ -v
```

**Expected results with a properly set-up project:**

| Suite | Domain | Tests | Result |
|-------|--------|-------|--------|
| Unit | auth | 19 | pass |
| Unit | merchants | — | pass |
| Unit | services (catalog) | — | pass |
| Unit | feed | — | pass |
| Unit | search | — | pass |
| Unit | storage | 17 | pass |
| Unit | health | 1 | pass |
| Integration | auth | 11 | pass |
| Integration | merchants | — | pass |
| Integration | services (catalog) | — | pass |
| Integration | feed (PostGIS) | — | pass |
| Integration | storage | 16 | pass |

> Test counts marked `—` are TBD as routes are implemented. The table will be updated per MVP.

---

## 8. Troubleshooting

### Integration tests skip with "Supabase not reachable"
- Check `SUPABASE_URL` in `backend/.env.test` is correct
- Verify the URL is reachable: `curl https://<your-ref>.supabase.co/rest/v1/`

### PostGIS query returns empty results
- Verify PostGIS extension is enabled: Dashboard → Database → Extensions → search "postgis" → should be ON
- Verify merchant has valid `location` data (not null, valid SRID 4326)
- Test query: `SELECT ST_AsText(location) FROM merchants LIMIT 1;`

### Upload fails with `new row violates row-level security policy`
- Storage RLS policies not applied — re-run `npx supabase db push`
- Verify the target bucket exists in Dashboard → Storage
- Verify upload path starts with `{user_id}/`

### Login returns error after signup in integration tests
- Email confirmation is enabled — disable it: Dashboard → Authentication → Providers → Email → Confirm email → OFF

### Phone OTP not received
- **Cloud**: Verify SMS provider (Twilio/MSG91) is configured in Dashboard → Authentication → Providers → Phone
- **Local**: OTP codes appear in Supabase Studio logs, not SMS

### `auth.admin.delete_user()` fails with "User not allowed"
- Ensure you're using the **service_role** key (not anon key) for `SUPABASE_SECRET_DEFAULT_KEY`

### `get_supabase()` returns stale client in tests
- `get_supabase()` is LRU-cached — call `get_supabase.cache_clear()` in test setup after reloading config

### Payment webhook writes fail with RLS error
- `payment_events` table has no user-facing RLS policies by design
- Webhook handler must use `get_supabase()` (service role), not `get_user_supabase()`

### Migrations fail with "already exists"
- For bucket conflicts: migrations use `ON CONFLICT (id) DO NOTHING`
- For policy conflicts: drop old policies in Dashboard → Database → Policies, then re-push
- For extension conflicts: `CREATE EXTENSION IF NOT EXISTS` handles this — safe to re-run

---

## 9. Credentials Reference

| Variable | Where to find it |
|----------|-----------------|
| `SUPABASE_URL` | Project Settings → API → Project URL |
| `SUPABASE_PUBLISHABLE_DEFAULT_KEY` | Project Settings → API → anon public |
| `SUPABASE_SECRET_DEFAULT_KEY` | Project Settings → API → service_role |
| `RAZORPAY_KEY_ID` | Razorpay Dashboard → Settings → API Keys |
| `RAZORPAY_KEY_SECRET` | Razorpay Dashboard → Settings → API Keys |
| `RAZORPAY_WEBHOOK_SECRET` | Razorpay Dashboard → Webhooks → Secret |
| `SARVAM_API_KEY` | Sarvam.ai Dashboard → API Keys |
| `LLM_API_KEY` | OpenAI Dashboard or Google AI Studio |
| Project Reference ID | Project URL or `npx supabase projects list` |

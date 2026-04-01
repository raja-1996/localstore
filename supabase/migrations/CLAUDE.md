# supabase/migrations
SQL migration files applied in order by Supabase CLI (`supabase db push` / `supabase db reset`).

- `001_initial_schema.sql` — creates all tables, RLS policies, indexes, and triggers for the initial schema
  - side-effects: DB DDL — creates tables `profiles` and `todos`; enables RLS; creates 6 RLS policies; creates 1 index; creates 3 triggers; enables Realtime on `todos`
  - types:
    - `profiles {id UUID PK → auth.users, email TEXT, full_name TEXT, avatar_url TEXT, created_at, updated_at}` — auto-created on signup via trigger
    - `todos {id UUID PK, user_id UUID → auth.users, title TEXT NOT NULL, description TEXT DEFAULT '', image_path TEXT, is_completed BOOLEAN DEFAULT false, created_at, updated_at}`
  - gotcha: `profiles` has no INSERT policy — row is created by the `handle_new_user()` trigger (SECURITY DEFINER), not by app code
  - gotcha: `todos` RLS policies use `auth.uid() = user_id` — all 4 CRUD ops are user-scoped (users can only see and modify their own todos)
  - gotcha: `handle_new_user` trigger runs AFTER INSERT on `auth.users` — if trigger fails, user is created in auth but has no profile row
  - gotcha: `supabase_realtime` publication is enabled on `todos` — frontend can subscribe to `postgres_changes` on this table
  - pattern: all `updated_at` columns auto-update via shared `update_updated_at()` trigger function (BEFORE UPDATE)

- `004_extensions.sql` — enables PostGIS, pg_trgm, and other required extensions
  - side-effects: creates extensions `postgis`, `pg_trgm`, `uuid-ossp`

- `005_profiles.sql` — extends LocalStore profiles schema with location, type, rating data
  - side-effects: alters `profiles` table, adds location-based indexes, denormalization columns for ratings/follower counts

- `006_merchants.sql` — creates merchants, services, and portfolio_images tables for seller side
  - side-effects: creates tables `merchants`, `services`, `portfolio_images`; enables RLS; creates indexes on location, service_type

- `007_services_portfolio.sql` — adds forward FK constraints from portfolio_images and reviews to orders (deferred constraints)
  - side-effects: adds FK constraints with deferrable mode; enables further table dependencies

- `008_storage_buckets.sql` — creates Supabase Storage bucket declarations for avatars, portfolios, posts, orders, receipts, voice, etc.
  - side-effects: bucket metadata; storage policies for public/signed URLs; CDN configuration notes

- `009_feed_search_rpc.sql` — PostgreSQL RPC functions for feed and search queries (MVP 1)
  - exports: `nearby_merchants(user_lat, user_lng, radius_m, limit, cursor)`, `search_merchants(q, category, min_rating, max_price, user_lat, user_lng, radius_m, limit)`, `search_services(q, min_rating, limit)`
  - side-effects: creates RPC functions using PostGIS and pg_trgm for geo + text search; enables cursor-based pagination

- `011_chat.sql` — creates chat infrastructure for real-time threads + messages (MVP 3)
  - side-effects: creates tables `chat_threads`, `chat_messages`; creates `is_chat_participant()` SECURITY DEFINER function; creates BEFORE INSERT trigger for `last_message_at` + unread counters; enables RLS + Realtime on both tables
  - tables: `chat_threads { id UUID PK, user_id UUID, merchant_id UUID, last_message_at, unread_by_user, unread_by_merchant, created_at, updated_at }`, `chat_messages { id UUID PK, thread_id FK, sender_id UUID, sender_role ENUM, content TEXT, read_by_user BOOLEAN, read_by_merchant BOOLEAN, created_at }`

- `012_orders.sql` — creates orders + payment_events tables for MVP 4 (Transactions)
  - side-effects: creates tables `orders`, `payment_events`; enables RLS on both; creates 4 indexes; creates `trg_orders_updated_at` trigger; enables Realtime on `orders`
  - tables: `orders { id UUID PK, user_id UUID, merchant_id UUID, service_id UUID, status TEXT, quantity INT, total_amount NUMERIC, advance_amount NUMERIC, balance_amount GENERATED, requirements_text, requirements_image_url, razorpay_order_id, razorpay_payment_id, refund_id, scheduled_at, cancellation_policy_snapshot, created_at, updated_at }`, `payment_events { id UUID PK, order_id UUID (nullable), event_type TEXT, razorpay_event_id TEXT UNIQUE, payload JSONB, processed_at }`
  - gotcha: `payment_events` has RLS enabled but NO user-facing policies — service role only
  - gotcha: `orders` UPDATE RLS policy does not restrict columns — API layer must enforce column-level restrictions
  - gotcha: `balance_amount` is `GENERATED ALWAYS AS (total_amount - advance_amount) STORED` — cannot be inserted/updated directly

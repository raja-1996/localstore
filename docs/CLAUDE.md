# docs
Architecture and implementation documentation for LocalStore — a hyperlocal services marketplace (React Native Expo + FastAPI + Supabase).

- `01-architecture.md` — System overview, 6 request flows (geo discovery, follow+feed, chat, order+payment, recommendation, voice search), 14 design decisions, directory structure (~22 backend routes, services layer, background tasks), storage buckets (7), realtime subscriptions
  - gotcha: Supabase Realtime connects directly from app (bypasses FastAPI); all other calls go through FastAPI proxy
  - gotcha: webhook route `POST /payments/webhook` excluded from auth middleware; validated by HMAC signature
  - gotcha: use separate Supabase projects for dev/staging/prod

- `02-tech-stack.md` — LocalStore-specific packages (maps, payments, audio, push) on top of base template; Supabase config (PostGIS, pg_trgm, Realtime, 7 storage buckets); external services (Razorpay, Sarvam.ai, SMS/OTP, LLM)

- `03-frontend-guide.md` — Expo Router file-based routing (LocalStore screen tree), 3 Zustand stores (auth, location, chat), TanStack Query patterns with LocalStore query keys, Supabase Realtime subscriptions (chat, orders, posts), service functions by MVP, Razorpay SDK integration
  - gotcha: never put test files inside `src/app/`
  - gotcha: `chat_messages` uses `read_by_user`/`read_by_merchant` booleans, not `is_read`
  - gotcha: Supabase JS client used ONLY for Realtime, not REST

- `04-backend-guide.md` — Full LocalStore backend structure: flat routes (22 files in api/v1/), services layer (6 business logic modules), background tasks (push, cleanup), all endpoints by MVP, auth dependency, Supabase client factory, pagination contract (cursor-based), order state machine, phone masking, multi-bucket storage, config shape, webhook security
  - gotcha: `get_current_user` bare except masks 503 as 401
  - gotcha: `OrderCreate` schema must NOT include `merchant_id`
  - gotcha: `payments.py` router excluded from JWT auth middleware

- `05-database-schema.md` — 16 tables with SQL, RLS policies, indexes, triggers, migration order (001–009)
  - gotcha: `payment_events` has RLS enabled but NO user-facing policies (service role only)
  - gotcha: `orders.merchant_id` derived server-side from `service_id`

- `06-testing-strategy.md` — Testing pyramid: backend (pytest + mock + integration), frontend (Jest + RNTL + MSW), E2E (Maestro). LocalStore-specific: PostGIS geo tests, Razorpay webhook HMAC tests, factory functions for merchants/orders/reviews
  - gotcha: use `msw/native` NOT `msw/node` for React Native

- `07-setup-guide.md` — Local setup: Supabase (region ap-south-1), backend, frontend. Full env var reference: Supabase + Razorpay + Sarvam + LLM keys. Local dev phone OTP via Studio logs.
  - gotcha: empty tokens on signup if email confirmation enabled
  - gotcha: PostGIS extension required for merchants.location

- `08-api-reference.md` — Complete REST API (~70 endpoints): auth (OTP), merchants (phone masking), services, portfolio, feed (cursor-paginated), search, follows, reviews, posts, likes, comments, chat, orders, payments (webhook + verify + refund), recommendations, leaderboard, referrals, voice search, festivals, need posts, insights, storage (public vs signed URLs), health

- `09-deployment-mobile.md` — app.json (all permissions + plugins), EAS Build, FCM + APNs push, Razorpay config plugin, Google Maps API key, OTA updates, pre-submission checklists
  - gotcha: `NSLocationWhenInUseUsageDescription` required for App Store
  - gotcha: `google-services.json` required for FCM delivery

- `10-deployment-backend.md` — Docker, cloud deployment, Nginx reverse proxy with rate limiting (OTP: 3/min, voice: 5/min, need-posts: 2/min), CDN for Supabase Storage, CORS production config, SSL, structured logging, Razorpay webhook endpoint requirements

- `11-supabase-setup.md` — Cloud project setup (Mumbai region), 9 LocalStore migrations, 7 storage buckets, phone OTP provider (Twilio/MSG91), RLS summary table, troubleshooting

- `IMPLEMENTATION_PLAN.md` — MVP-based roadmap (Foundation + 6 MVPs), ~200 files total, implementation order (20 steps), background jobs summary, file count estimates

- `roles/` — virtual team role activity logs (see `roles/CLAUDE.md`)

- `mvp/` — per-MVP breakdown docs (00-overview through mvp6-intelligence)

- `product-ideas.md` — brainstormed product ideas and future features

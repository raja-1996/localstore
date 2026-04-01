# LocalStore — Setup Guide

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Node.js | 20+ | `nvm install 20` |
| Python | 3.12+ | `pyenv install 3.12` |
| uv | latest | `curl -LsSf https://astral.sh/uv/install.sh \| sh` |
| Supabase CLI | latest | `brew install supabase/tap/supabase` |
| Docker | latest | Docker Desktop or `brew install --cask docker` |
| Expo CLI | (via npx) | Bundled with `expo` package |
| Maestro | latest | `curl -Ls https://get.maestro.mobile.dev \| bash` (E2E only) |

---

## 1. Supabase Setup

### 1a. Cloud Project (recommended)

> **Region**: Always select **ap-south-1 (Mumbai)** when creating the project. This gives 20–50ms latency for Indian users vs 200ms+ from US-east.

1. Go to [supabase.com](https://supabase.com) → New Project
2. Select region: **South Asia (Mumbai)**
3. Note your **Project Reference ID** from the project URL
4. From **Project Settings → API**, copy:
   - `Project URL` → `SUPABASE_URL`
   - `anon public` key → `SUPABASE_PUBLISHABLE_DEFAULT_KEY`
   - `service_role` key → `SUPABASE_SECRET_DEFAULT_KEY`
5. See `docs/11-supabase-setup.md` for full Supabase configuration (migrations, buckets, phone OTP provider, RLS)

### 1b. Local Development

```bash
# Start local Supabase stack (Postgres, Auth, Storage, Realtime, Studio)
supabase start

# Output shows connection details:
#   API URL:    http://localhost:54321
#   anon key:   sb_publishable_...
#   service_role key: sb_secret_...
#   Studio URL: http://localhost:54323

# Apply all 9 migrations
supabase db push
```

---

## 2. Backend

```bash
cd backend

# Copy env and fill in values (see env var table below)
cp .env.example .env

# Install dependencies
uv sync

# Install test dependencies
uv sync --extra test

# Run server (hot reload)
uv run uvicorn app.main:app --reload --port 8000

# Verify
curl http://localhost:8000/health
# → {"status":"ok"}
```

### Backend with Docker

```bash
# From project root
docker compose up --build
```

---

## 3. Frontend

```bash
cd app

# Copy env
cp .env.example .env
# Fill in values (see env var table below)

# Install dependencies
npm install

# Start Expo dev server
npx expo start

# Press:
#   i → iOS simulator
#   a → Android emulator
#   w → Web browser
```

---

## 4. Run Tests

### Frontend
```bash
cd app
npm test                    # Unit tests
npm run test:coverage       # Unit tests + coverage report
npm run test:integration    # Integration tests (requires running backend)
```

### Backend
```bash
cd backend
uv run pytest                          # Unit tests (mocked Supabase)
uv run pytest --cov=app               # With coverage
uv run pytest tests/integration/ -v   # Integration (requires supabase start + uvicorn)
```

### E2E
```bash
# Ensure app is running on simulator + backend is up
maestro test e2e/maestro/login-flow.yaml
```

---

## Environment Variables Reference

### Backend (`.env`)

#### Supabase (required)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SUPABASE_URL` | Yes | — | Supabase API gateway URL |
| `SUPABASE_PUBLISHABLE_DEFAULT_KEY` | Yes | — | Anon/publishable key (used for user-scoped RLS client) |
| `SUPABASE_SECRET_DEFAULT_KEY` | Yes | — | Service role key (admin ops, bypasses RLS) |

#### Razorpay (required for MVP 4+)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `RAZORPAY_KEY_ID` | MVP 4+ | — | Razorpay API key ID |
| `RAZORPAY_KEY_SECRET` | MVP 4+ | — | Razorpay API key secret |
| `RAZORPAY_WEBHOOK_SECRET` | MVP 4+ | — | Webhook signature verification secret (from Razorpay Dashboard → Webhooks) |

> **Webhook HMAC**: The `RAZORPAY_WEBHOOK_SECRET` is used to verify `X-Razorpay-Signature` on `POST /payments/webhook`. Without it, webhook payloads cannot be authenticated. The backend rejects payloads older than 5 minutes (replay window).

#### AI/Voice Services (required for MVP 6)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SARVAM_API_KEY` | MVP 6 | — | Sarvam.ai API key for Indian-language STT and TTS |
| `LLM_API_KEY` | MVP 6 | — | API key for LLM provider (intent extraction from voice transcript) |
| `LLM_PROVIDER` | No | `openai` | LLM provider: `openai` (GPT-4o-mini) or `gemini` (Gemini Flash) |

#### Application

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `CORS_ORIGINS` | No | `["http://localhost:8081"]` | JSON array of allowed CORS origins. **Production must list exact domains** — never use `*` |
| `DEBUG` | No | `false` | Enable FastAPI debug mode |

### Frontend (`.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `EXPO_PUBLIC_API_URL` | Yes | FastAPI backend URL (`http://localhost:8000` for dev) |
| `EXPO_PUBLIC_SUPABASE_URL` | Yes | Supabase API gateway URL |
| `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Yes | Anon/publishable key |
| `EXPO_PUBLIC_RAZORPAY_KEY_ID` | MVP 4+ | Razorpay public key (for Razorpay SDK in-app) |

---

## Supabase Local Config

`supabase/config.toml` key settings:
- Auth: Phone OTP enabled, email signup enabled, email confirmations **disabled** (local dev convenience)
- Storage: 50 MiB file size limit
- Realtime: enabled on `chat_messages`, `orders`, `posts`
- Extensions: `postgis`, `pg_trgm`, `uuid-ossp` enabled

> **Phone OTP in local dev**: Local Supabase uses a fake SMS provider — OTP codes appear in the Supabase Studio logs (Dashboard → Authentication → Logs). No Twilio/MSG91 config needed locally.

---

## Gotchas

- **Empty tokens on signup**: If email confirmation is enabled in Supabase dashboard, `POST /auth/signup` returns empty `access_token`/`refresh_token` with `expires_in == 0`. This is not a bug — disable email confirmation for dev/test (see `docs/11-supabase-setup.md`).
- **PostGIS required**: The `merchants.location` column uses `GEOGRAPHY(POINT, 4326)`. If PostGIS extension is missing, migration `001_extensions.sql` will fail. Supabase Cloud enables PostGIS natively. For local: it's included in the Supabase Docker image.
- **Separate Supabase projects per environment**: Dev, staging, and prod must each have their own Supabase project. Never share a project across environments — RLS policies and data must be isolated.

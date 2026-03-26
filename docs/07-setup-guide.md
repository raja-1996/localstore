# Setup Guide

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

## 1. Supabase (Local)

```bash
# Start local Supabase stack (Postgres, Auth, Storage, Realtime, Studio)
supabase start

# Output shows connection details:
#   API URL:    http://localhost:54321
#   anon key:   sb_publishable_...
#   service_role key: sb_secret_...
#   Studio URL: http://localhost:54323

# Apply migrations
supabase db push
```

## 2. Backend

```bash
cd backend

# Copy env and fill in Supabase keys from step 1
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

## 3. Frontend

```bash
cd app

# Copy env
cp .env.example .env
# Set EXPO_PUBLIC_API_URL=http://localhost:8000
# Set EXPO_PUBLIC_SUPABASE_URL=http://localhost:54321
# Set EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY from supabase start output

# Install dependencies
npm install

# Start Expo dev server
npx expo start

# Press:
#   i → iOS simulator
#   a → Android emulator
#   w → Web browser
```

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

## Environment Variables Reference

### Backend (`.env`)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SUPABASE_URL` | Yes | - | Supabase API gateway URL |
| `SUPABASE_PUBLISHABLE_DEFAULT_KEY` | Yes | - | Anon/publishable key |
| `SUPABASE_SECRET_DEFAULT_KEY` | Yes | - | Service role key (admin) |
| `CORS_ORIGINS` | No | `["http://localhost:8081"]` | JSON array of allowed origins |
| `DEBUG` | No | `false` | Enable debug mode |

Legacy key names also supported: `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.

### Frontend (`.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `EXPO_PUBLIC_API_URL` | Yes | FastAPI backend URL |
| `EXPO_PUBLIC_SUPABASE_URL` | Yes | Supabase API gateway URL |
| `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Yes | Anon/publishable key |

## Supabase Local Config

`supabase/config.toml` key settings:
- Auth: email signup enabled, email confirmations **disabled** (local dev convenience)
- Storage: 50 MiB file size limit
- Realtime: enabled

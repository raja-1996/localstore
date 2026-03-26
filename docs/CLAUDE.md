# docs
Human-readable reference documentation for the full-stack React Native + FastAPI + Supabase template project.

- `01-architecture.md` — system overview, request flow, key design decisions, directory structure
  - gotcha: Supabase Realtime connects directly from app (bypasses FastAPI); all other calls go through FastAPI proxy

- `02-tech-stack.md` — package list with versions for frontend (Expo SDK 55), backend (FastAPI 0.135+), and Supabase services
  - gotcha: `react-test-renderer` is NOT compatible with React 19 — use `@testing-library/react-native`

- `03-frontend-guide.md` — Expo Router file-based routing, Zustand auth store shape, TanStack Query patterns, Axios interceptor, Supabase client usage, theming, env vars
  - gotcha: never put test files inside `src/app/` — Expo Router treats all files there as routes
  - gotcha: Supabase JS client is used ONLY for Realtime WebSocket, not for REST calls

- `04-backend-guide.md` — FastAPI structure, auth dependency injection, Supabase client factory (`get_supabase` vs `get_user_supabase`), all API endpoints, `Settings` config shape, Docker/docker-compose, CORS
  - gotcha: two Supabase client modes — service-role (admin ops) vs user-scoped (RLS enforcement)

- `05-database-schema.md` — PostgreSQL tables (`profiles`, `rooms`, `messages`) with RLS policies, indexes, triggers, Realtime config, migration commands, local dev ports
  - gotcha: actual implementation uses `todos` table (not rooms/messages) — see `IMPLEMENTATION_PLAN.md` for authoritative schema

- `06-testing-strategy.md` — testing pyramid, frontend (Jest + RNTL + MSW), backend (pytest + mock), E2E (Maestro), CI pipeline
  - gotcha: use `msw/native` NOT `msw/node` for React Native; requires `react-native-url-polyfill` + `fast-text-encoding` polyfills

- `07-setup-guide.md` — step-by-step local setup for Supabase, backend, frontend; all env vars with descriptions; `supabase/config.toml` key settings

- `08-api-reference.md` — complete REST API docs: request/response shapes for auth, rooms, messages, storage, health; error response format

- `09-deployment-mobile.md` — EAS Build/Submit pipeline, `eas.json` build profiles (development/preview/production), OTA updates via EAS Update, `app.json` production config, asset requirements, CI/CD

- `10-deployment-backend.md` — Linux server deployment: Nginx + Gunicorn + Uvicorn stack, systemd service, SSL via Certbot, deployment script with rollback, firewall, scaling
  - gotcha: do NOT expose port 8000 — Gunicorn binds to Unix socket; only Nginx talks to it

- `activity-log.md` — chronological log of changes made to the project (not the roles activity log)
  - gotcha: this is a project changelog, different from `roles/activity-log.md` which is the virtual team role log

- `IMPLEMENTATION_PLAN.md` — feature roadmap (8 phases: foundation, frontend, auth, todos, image upload, realtime, push notifications, polish); authoritative schema for `profiles` and `todos` tables; implementation order

- `roles/` — virtual team role activity logs (see `roles/CLAUDE.md`)

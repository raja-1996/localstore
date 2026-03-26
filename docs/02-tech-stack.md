# Tech Stack

## Frontend — React Native (Expo)

| Category | Package | Version | Purpose |
|----------|---------|---------|---------|
| Framework | `expo` | SDK 55 | Managed workflow, OTA updates, build service |
| Runtime | `react-native` | 0.83.x | Cross-platform native UI |
| React | `react` | 19.2 | UI library |
| Routing | `expo-router` | 55.x | File-based routing, deep linking, typed routes |
| Navigation | `@react-navigation/bottom-tabs` | 7.x | Tab bar navigation |
| Server State | `@tanstack/react-query` | 5.x | Caching, background refetch, optimistic updates |
| Client State | `zustand` | 5.x | Lightweight store, no providers, persist middleware |
| HTTP | `axios` | 1.x | Request interceptors for auth, response transforms |
| Realtime | `@supabase/supabase-js` | 2.x | WebSocket subscriptions (Realtime only, not for REST) |
| Auth Storage | `expo-secure-store` | 55.x | Native encrypted keychain |
| Image Picking | `expo-image-picker` | 55.x | Camera/gallery access |
| Animations | `react-native-reanimated` | 4.x | Native-driven animations |

## Backend — FastAPI (Python)

| Category | Package | Version | Purpose |
|----------|---------|---------|---------|
| Framework | `fastapi` | >=0.135 | Async API framework, auto OpenAPI docs |
| Server | `uvicorn` | >=0.42 | ASGI server |
| Supabase | `supabase` | >=2.28 | Python SDK (Auth, DB, Storage) |
| Validation | `pydantic` | >=2.12 | Request/response schemas, email validation |
| Config | `pydantic-settings` | >=2.13 | .env file loading, typed settings |
| File Upload | `python-multipart` | >=0.0.22 | Multipart form data parsing |
| Python | | 3.12 | Runtime (3.11+ required) |
| Pkg Manager | `uv` | | Fast dependency resolution, lockfile |

## Platform — Supabase

| Service | Usage |
|---------|-------|
| **Auth (GoTrue)** | Email/password signup, JWT token issuance, token refresh |
| **PostgreSQL** | Primary database with Row Level Security (RLS) |
| **Realtime** | WebSocket broadcast for live message updates |
| **Storage** | File/image uploads with signed URLs |
| **Supabase CLI** | Local development (`supabase start`), migrations |

## Infrastructure

| Tool | Purpose |
|------|---------|
| Docker | Backend containerization (multi-stage build) |
| docker-compose | Local backend orchestration |
| Supabase CLI | Local Supabase stack (Postgres, Auth, Storage, Realtime) |
| GitHub Actions | CI/CD pipeline |

## Key Version Constraints

- React 19.2+ required (Expo SDK 55 dependency)
- `react-test-renderer` is **NOT compatible** with React 19 — use `@testing-library/react-native` instead
- Python 3.11+ required for Pydantic v2 + modern typing syntax
- Supabase JS v2 uses new modular API (not v1 `supabase.from()` syntax)

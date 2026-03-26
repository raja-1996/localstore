# Architecture

## System Overview

Full-stack mobile application template: React Native (Expo) frontend, FastAPI backend, Supabase platform services.

```
┌─────────────────────────────────┐
│  React Native (Expo SDK 55)     │
│  ┌───────────┐ ┌──────────────┐ │
│  │ Zustand   │ │ TanStack     │ │
│  │ (client)  │ │ Query (server)│ │
│  └───────────┘ └──────┬───────┘ │
│                       │         │
│  Axios ───────────────┤         │
│                       │         │
│  Supabase JS ─────────┼─── Realtime WS (direct)
└───────────────────────┼─────────┘
                        │ HTTP
┌───────────────────────┼─────────┐
│  FastAPI Backend      │         │
│  ┌────────┐ ┌────────┴───────┐ │
│  │ Auth   │ │ API Routes     │ │
│  │ Guard  │ │ /api/v1/*      │ │
│  └────────┘ └────────┬───────┘ │
│                      │         │
│  Supabase Python SDK │         │
└──────────────────────┼─────────┘
                       │
┌──────────────────────┼─────────┐
│  Supabase Platform   │         │
│  ┌────────┐ ┌────────┴───────┐ │
│  │ Auth   │ │ PostgreSQL     │ │
│  │ GoTrue │ │ + RLS Policies │ │
│  ├────────┤ ├────────────────┤ │
│  │Storage │ │ Realtime       │ │
│  │ S3     │ │ WebSocket      │ │
│  └────────┘ └────────────────┘ │
└────────────────────────────────┘
```

## Request Flow

1. User action triggers TanStack Query mutation/query
2. Axios interceptor attaches `Authorization: Bearer <access_token>` header
3. FastAPI receives request, `get_current_user` dependency validates token via Supabase Auth
4. Route handler creates user-scoped Supabase client (inherits RLS context)
5. Supabase executes query against Postgres with RLS enforcement
6. Response flows back through FastAPI → Axios → TanStack Query cache → React component

**Exception**: Supabase Realtime connects directly from the app via WebSocket (bypasses FastAPI). Used for live message updates only.

## Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Backend between app and Supabase | FastAPI proxy | Service role access, business logic layer, swappable backend |
| Client state | Zustand | Minimal boilerplate, no providers needed, TypeScript-first |
| Server state | TanStack Query v5 | Cache invalidation, optimistic updates, background refetch |
| HTTP client | Axios | Interceptors for auth token injection, request/response transforms |
| Realtime | Supabase JS direct | WebSocket must connect from client; no FastAPI proxy needed |
| Routing | Expo Router (file-based) | Convention over configuration, deep linking built-in |
| Auth token storage | expo-secure-store | Encrypted native keychain storage (iOS Keychain, Android Keystore) |

## Directory Structure

```
project-root/
├── app/                          # React Native (Expo)
│   ├── src/
│   │   ├── app/                  # Expo Router file-based routes
│   │   │   ├── (auth)/           # Unauthenticated routes
│   │   │   ├── (app)/            # Authenticated routes (guarded)
│   │   │   ├── _layout.tsx       # Root layout (providers)
│   │   │   └── index.tsx         # Auth redirect
│   │   ├── components/           # Shared UI components
│   │   ├── hooks/                # Custom React hooks
│   │   ├── lib/                  # Axios client, query client, supabase client
│   │   ├── services/             # API service functions (typed)
│   │   ├── stores/               # Zustand stores
│   │   └── constants/            # Theme, config constants
│   ├── __tests__/                # Tests (NOT inside app/ — Expo Router restriction)
│   │   ├── unit/
│   │   └── integration/
│   ├── e2e/                      # Maestro E2E flows
│   │   └── maestro/
│   ├── jest.config.js
│   ├── jest.integration.config.js
│   └── package.json
│
├── backend/                      # FastAPI
│   ├── app/
│   │   ├── api/v1/               # Versioned route handlers
│   │   ├── core/                 # Auth dependency, config, supabase factory
│   │   ├── schemas/              # Pydantic request/response models
│   │   └── main.py               # App entrypoint + CORS
│   ├── tests/
│   │   ├── unit/                 # Mocked Supabase tests
│   │   ├── integration/          # Live Supabase tests (auto-skip if unavailable)
│   │   ├── conftest.py           # Shared fixtures
│   │   └── factories.py          # Test data factories
│   ├── pyproject.toml            # uv dependencies
│   └── Dockerfile                # Multi-stage build
│
├── supabase/
│   ├── config.toml               # Local Supabase config
│   └── migrations/               # SQL migrations (schema + RLS)
│
├── docker-compose.yml            # Backend service
├── docker-compose.test.yml       # Full-stack test environment
└── docs/                         # This documentation
```

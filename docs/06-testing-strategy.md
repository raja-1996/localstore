# Testing Strategy

## Testing Pyramid

```
        ┌─────────────┐
        │   E2E Tests  │  Maestro (critical user journeys)
        │    (~10%)    │
        ├─────────────┤
        │ Integration  │  MSW (frontend) + live Supabase (backend)
        │   (~20%)     │
        ├─────────────┤
        │  Unit Tests  │  Jest + RNTL (frontend) + pytest (backend)
        │   (~70%)     │
        └─────────────┘
```

Goal: confidence that the app works for real users, not 100% coverage. Start small — a handful of well-written component tests and one or two Maestro flows catch a surprising number of regressions.

## Frontend Testing

### Unit & Component Tests

**Stack**: Jest 30 + `jest-expo` + `@testing-library/react-native` (RNTL)

| Package | Purpose |
|---------|---------|
| `jest-expo` | Preset with React Native transforms; use `jest-expo/universal` for cross-platform |
| `@testing-library/react-native` | Component rendering + user-centric queries (replaces deprecated `react-test-renderer`) |
| `expo-router/testing-library` | In-memory Expo Router for testing navigation |

**What to test:**
- Zustand stores (login/logout state transitions, token management)
- Custom hooks (data fetching, realtime subscriptions)
- Form validation (empty fields, invalid email)
- Conditional rendering (loading states, error states, empty states)
- Service functions (API call construction, response transforms)

**What NOT to test:**
- Snapshot tests (Expo recommends E2E instead)
- Third-party library internals
- Simple presentational components with no logic

**File structure:**
```
__tests__/
├── unit/
│   ├── components/    # Screen + component render tests
│   ├── hooks/         # Hook behavior tests
│   ├── stores/        # Zustand store tests
│   └── services/      # API service function tests
└── integration/       # MSW-backed full screen tests
```

**Jest config patterns:**
- `jest.config.js` — unit tests (excludes `__tests__/integration/`)
- `jest.integration.config.js` — integration tests only
- `jest.setup.js` — global mocks (expo-secure-store, expo-router, @supabase/supabase-js, expo-image-picker)
- Module name mapper: `^@/(.*)$` → `<rootDir>/src/$1`

**Test utilities** — create `__tests__/test-utils.tsx`:

```typescript
import { render } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

function AllProviders({ children }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

const customRender = (ui, options) => render(ui, { wrapper: AllProviders, ...options });
export * from '@testing-library/react-native';
export { customRender as render };
```

### Integration Tests (MSW)

**Stack**: MSW 2.x (`msw/native`) + RNTL + Jest

MSW intercepts network requests at the network level — no need to mock axios or fetch manually. This is the gold standard for testing components that make API calls.

| Package | Purpose |
|---------|---------|
| `msw` | Mock Service Worker — network-level request interception |
| `react-native-url-polyfill` | Required polyfill (MSW depends on `URL` class) |
| `fast-text-encoding` | Required polyfill (MSW depends on `TextEncoder`) |

**Important**: Use `msw/native` import, NOT `msw/node` (React Native doesn't have Node's `http` module).

**Setup in `jest.setup.js`:**
```javascript
import { server } from './__tests__/mocks/server';
beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

**Handler example:**
```typescript
// __tests__/mocks/handlers.ts
import { http, HttpResponse } from 'msw';

export const handlers = [
  http.get('*/api/v1/rooms', () =>
    HttpResponse.json([{ id: 'room-1', name: 'General' }])
  ),
  http.post('*/api/v1/auth/login', async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json({ access_token: 'fake-token', user: { id: '1', email: body.email } });
  }),
];
```

**What to test with MSW:**
- Full screen renders with real API data flowing through TanStack Query
- Auth flows (login → redirect, token refresh, logout)
- Error states (500 responses, network failures)
- Loading states
- Optimistic updates and cache invalidation

**Dynamic overrides** for specific test cases:
```typescript
import { server } from '../mocks/server';
import { http, HttpResponse } from 'msw';

it('shows error on server failure', async () => {
  server.use(http.get('*/api/v1/rooms', () => HttpResponse.json({ error: 'fail' }, { status: 500 })));
  // ... render and assert error UI
});
```

**Note on polyfills**: `react-native-url-polyfill` and `fast-text-encoding` are runtime dependencies that will be bundled into the production app. They're small and harmless but worth being aware of.

### E2E Tests (Maestro)

**Stack**: Maestro CLI (standalone — zero project dependencies)

Maestro is a black-box mobile UI testing framework. YAML-based, <1% flakiness, no native modules to install.

**Why Maestro over Detox:**
- Zero project setup (standalone CLI, no native module changes)
- YAML syntax (non-engineers can write tests)
- <1% flakiness vs Detox's <2%
- Framework-agnostic (works with RN, Flutter, native)
- Detox requires complex native build targets and Xcode/Gradle config

**When you'd want Detox instead**: gray-box testing (accessing internal app state), complex async flow synchronization, or if you need to test native module internals.

**File structure:**
```
e2e/
└── maestro/
    ├── login-flow.yaml
    ├── signup-flow.yaml
    ├── create-room.yaml
    ├── send-message.yaml
    └── config.yaml
```

**Example flow:**
```yaml
# e2e/maestro/login-flow.yaml
appId: com.yourapp
---
- launchApp
- tapOn: "Email"
- inputText: "test@example.com"
- tapOn: "Password"
- inputText: "password123"
- tapOn: "Sign In"
- assertVisible: "Rooms"
```

**Running:**
```bash
# Install Maestro (one-time)
curl -Ls https://get.maestro.mobile.dev | bash

# Run single flow
maestro test e2e/maestro/login-flow.yaml

# Run all flows
maestro test e2e/maestro/
```

**Prerequisites**: app must be running on a simulator/emulator. Maestro connects to the device's accessibility layer.

## Backend Testing

### Unit Tests

**Stack**: pytest + FastAPI TestClient + MagicMock

| Package | Purpose |
|---------|---------|
| `pytest` | Test runner + fixtures |
| `pytest-asyncio` | Async test support |
| `httpx` | Required by FastAPI TestClient |
| `pytest-cov` | Coverage reporting |
| `pytest-mock` | Enhanced mocking utilities |
| `faker` | Realistic random test data |

**Mocking strategy:**
- Supabase module mocked at `sys.modules` level before any app imports
- `get_current_user` dependency overridden to return fake user
- All Supabase client factories patched to return `MagicMock`

**Fixtures (`conftest.py`):**
```python
FAKE_USER = {"id": "user-123", "email": "test@example.com", "token": "fake-token"}

@pytest.fixture()
def mock_supabase():
    mock_client = MagicMock()
    with (
        patch("app.core.supabase.get_supabase", return_value=mock_client),
        patch("app.api.v1.auth.get_supabase", return_value=mock_client),
        patch("app.api.v1.notes.get_user_supabase", return_value=mock_client),
    ):
        yield mock_client

@pytest.fixture()
def authenticated_client(mock_supabase):
    app.dependency_overrides[get_current_user] = lambda: FAKE_USER
    with TestClient(app) as client:
        yield client
    app.dependency_overrides.clear()
```

**Test data factories** — use simple helper functions (not Factory Boy, since models are Pydantic schemas, not ORM):

```python
# tests/factories.py
from faker import Faker
fake = Faker()

def make_room(**overrides):
    return {
        "id": overrides.get("id", str(fake.uuid4())),
        "name": overrides.get("name", fake.catch_phrase()),
        "created_by": overrides.get("created_by", str(fake.uuid4())),
        "created_at": overrides.get("created_at", fake.iso8601()),
        "updated_at": overrides.get("updated_at", fake.iso8601()),
    }

def make_message(room_id=None, user_id=None, **overrides):
    return {
        "id": overrides.get("id", str(fake.uuid4())),
        "room_id": room_id or str(fake.uuid4()),
        "user_id": user_id or str(fake.uuid4()),
        "content": overrides.get("content", fake.sentence()),
        "image_path": overrides.get("image_path", None),
        "created_at": overrides.get("created_at", fake.iso8601()),
        "updated_at": overrides.get("updated_at", fake.iso8601()),
    }
```

**What to test:**
- Every endpoint: success path, validation errors (422), not found (404), unauthorized (401)
- Pydantic schema validation (required fields, email format, edge cases)
- Auth flow (signup, login, token refresh, logout)
- Error handling (Supabase errors surfaced correctly)

### Integration Tests (Live Supabase)

**Stack**: pytest + httpx + real Supabase instance

Integration tests hit a running backend connected to a real local Supabase. They auto-skip when infrastructure is unavailable.

**Skip markers:**
```python
requires_supabase = pytest.mark.skipif(not _supabase_reachable(), reason="...")
requires_backend = pytest.mark.skipif(not _backend_reachable(), reason="...")
requires_infra = pytest.mark.skipif(not (_supabase_reachable() and _backend_reachable()), reason="...")
```

**Test user management:**
- Creates a unique test user per session via Supabase Admin API
- Uses `email_confirm: True` to bypass email verification
- All test data scoped to that user

**What to test:**
- Full CRUD lifecycle (create → list → get → update → delete)
- RLS enforcement (user can't modify other users' data)
- Edge cases against real Postgres (JSONB, timestamps, UUIDs)
- Auth flow end-to-end with real Supabase GoTrue

**Running:**
```bash
# Start infrastructure
supabase start
uvicorn app.main:app --reload

# Run integration tests
cd backend && pytest tests/integration/ -v
```

**Note on Testcontainers**: Testcontainers (`testcontainers[postgresql]`) can spin up a real Postgres in Docker for integration tests without needing a running Supabase. This is useful for CI or testing Postgres-specific features (JSONB, RLS). However, it adds Docker as a hard test dependency. The current approach (auto-skip when Supabase unavailable) is simpler for a template. Add Testcontainers when you need hermetic CI or test Postgres features without full Supabase.

## Backend Test Dependencies

```toml
# pyproject.toml [project.optional-dependencies]
test = [
    "pytest>=8.0.0",
    "pytest-asyncio>=0.25.0",
    "pytest-cov>=6.0.0",
    "pytest-mock>=3.14.0",
    "httpx>=0.28.0",
    "faker>=33.0.0",
]
```

Install: `uv sync --extra test`

## Coverage

### Frontend
```bash
npx jest --coverage
# Collects from src/**/*.{ts,tsx}, excludes .d.ts and assets
# Enforced minimum: configure in jest.config.js:
# coverageThreshold: { global: { branches: 80, functions: 80, lines: 80 } }
```

### Backend
```bash
pytest --cov=app --cov-report=term-missing --cov-fail-under=80
```

## NPM Scripts

```json
{
  "test": "jest --config jest.config.js",
  "test:watch": "jest --config jest.config.js --watch",
  "test:coverage": "jest --config jest.config.js --coverage",
  "test:integration": "jest --config jest.integration.config.js",
  "test:e2e": "maestro test e2e/maestro/"
}
```

## CI Pipeline (GitHub Actions)

```yaml
jobs:
  frontend-unit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: cd app && npm ci && npm test -- --coverage

  backend-unit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: astral-sh/setup-uv@v4
      - run: cd backend && uv sync --extra test && pytest --cov=app --cov-fail-under=80

  e2e:
    runs-on: macos-latest  # iOS simulator required for Maestro
    needs: [frontend-unit, backend-unit]
    steps:
      - uses: actions/checkout@v4
      - run: curl -Ls https://get.maestro.mobile.dev | bash
      - run: # start app + backend, then maestro test e2e/maestro/
```

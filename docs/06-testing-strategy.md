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

Goal: confidence that the app works for real users, not 100% coverage. A handful of well-written component tests and a few Maestro flows catch most regressions.

---

## Frontend Testing

### Unit & Component Tests

**Stack**: Jest 30 + `jest-expo` + `@testing-library/react-native` (RNTL)

| Package | Purpose |
|---------|---------|
| `jest-expo` | Preset with React Native transforms; use `jest-expo/universal` for cross-platform |
| `@testing-library/react-native` | Component rendering + user-centric queries (replaces deprecated `react-test-renderer`) |
| `expo-router/testing-library` | In-memory Expo Router for testing navigation |

**What to test:**
- Zustand auth store (login/logout state, token management)
- Custom hooks (merchant data fetching, order status)
- Form validation (order forms, review forms, search input)
- Conditional rendering (loading states, error states, empty feed)
- Service functions (API call construction, response transforms)

**What NOT to test:**
- Snapshot tests (Expo recommends E2E instead)
- Third-party library internals
- Simple presentational components with no logic

**File structure:**
```
app/__tests__/
├── setup.ts                   # MSW server, jest globals
├── factories/
│   ├── merchant.ts            # makeMerchant()
│   ├── order.ts               # makeOrder()
│   ├── review.ts              # makeReview()
│   └── service.ts             # makeService()
├── components/                # MerchantCard, OrderForm, ReviewCard
├── hooks/                     # useFeed, useOrder, useMerchant
├── services/                  # API service function tests (MSW)
└── integration/               # Screen-level tests (MSW-backed)
```

**Jest config patterns:**
- `jest.config.js` — unit tests (excludes `__tests__/integration/`)
- `jest.integration.config.js` — integration tests only
- `jest.setup.js` — global mocks (`expo-secure-store`, `expo-router`, `@supabase/supabase-js`, `expo-image-picker`)
- Module name mapper: `^@/(.*)$` → `<rootDir>/src/$1`

**Test utilities** — create `__tests__/test-utils.tsx`:

```typescript
import { render } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

function AllProviders({ children }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

const customRender = (ui, options) =>
  render(ui, { wrapper: AllProviders, ...options });

export * from '@testing-library/react-native';
export { customRender as render };
```

---

### Factory Functions

Use simple helper functions (not Factory Boy). Models are Pydantic schemas / plain objects — no ORM required.

```typescript
// __tests__/factories/merchant.ts
import { faker } from '@faker-js/faker';

export function makeMerchant(overrides = {}) {
  return {
    id: faker.string.uuid(),
    owner_id: faker.string.uuid(),
    business_name: faker.company.name(),
    category: 'plumber',
    bio: faker.lorem.sentence(),
    city: 'Hyderabad',
    lat: 17.385,
    lng: 78.4867,
    rating_avg: parseFloat(faker.number.float({ min: 3, max: 5, fractionDigits: 1 }).toFixed(1)),
    rating_count: faker.number.int({ min: 0, max: 500 }),
    is_available: true,
    created_at: faker.date.past().toISOString(),
    ...overrides,
  };
}

export function makeService(merchantId?: string, overrides = {}) {
  return {
    id: faker.string.uuid(),
    merchant_id: merchantId ?? faker.string.uuid(),
    name: faker.commerce.productName(),
    description: faker.lorem.sentence(),
    price: parseFloat(faker.commerce.price({ min: 100, max: 5000 })),
    unit: 'per visit',
    is_active: true,
    created_at: faker.date.past().toISOString(),
    ...overrides,
  };
}

export function makeOrder(overrides = {}) {
  return {
    id: faker.string.uuid(),
    user_id: faker.string.uuid(),
    merchant_id: faker.string.uuid(),
    service_id: faker.string.uuid(),
    status: 'pending',
    scheduled_at: faker.date.future().toISOString(),
    address: faker.location.streetAddress(),
    total_amount: faker.number.int({ min: 100, max: 5000 }),
    payment_status: 'unpaid',
    created_at: faker.date.past().toISOString(),
    ...overrides,
  };
}

export function makeReview(overrides = {}) {
  return {
    id: faker.string.uuid(),
    reviewer_id: faker.string.uuid(),
    merchant_id: faker.string.uuid(),
    order_id: faker.string.uuid(),
    rating: faker.number.int({ min: 1, max: 5 }),
    comment: faker.lorem.sentences(2),
    created_at: faker.date.past().toISOString(),
    ...overrides,
  };
}
```

---

### Integration Tests (MSW)

**Stack**: MSW 2.x (`msw/native`) + RNTL + Jest

MSW intercepts network requests at the network level — no need to mock axios or fetch manually.

| Package | Purpose |
|---------|---------|
| `msw` | Mock Service Worker — network-level request interception |
| `react-native-url-polyfill` | Required polyfill (`URL` class) |
| `fast-text-encoding` | Required polyfill (`TextEncoder`) |

**Important**: Use `msw/native`, NOT `msw/node` — React Native does not have Node's `http` module.

**Setup in `jest.setup.ts`:**
```typescript
import { server } from './__tests__/mocks/server';
beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

**LocalStore handlers:**
```typescript
// __tests__/mocks/handlers.ts
import { http, HttpResponse } from 'msw';
import { makeMerchant, makeOrder, makeService } from '../factories';

export const handlers = [
  http.get('*/api/v1/merchants', () =>
    HttpResponse.json([makeMerchant(), makeMerchant()])
  ),

  http.get('*/api/v1/merchants/:id', ({ params }) =>
    HttpResponse.json(makeMerchant({ id: params.id as string }))
  ),

  http.get('*/api/v1/feed/nearby', () =>
    HttpResponse.json({ merchants: [makeMerchant()], cursor: null })
  ),

  http.get('*/api/v1/orders', () =>
    HttpResponse.json([makeOrder(), makeOrder()])
  ),

  http.post('*/api/v1/orders', async ({ request }) => {
    const body = await request.json() as Record<string, unknown>;
    return HttpResponse.json(makeOrder({ service_id: body.service_id }), { status: 201 });
  }),

  http.post('*/api/v1/auth/otp/send', () =>
    HttpResponse.json({ message: 'OTP sent' })
  ),

  http.post('*/api/v1/auth/otp/verify', () =>
    HttpResponse.json({
      access_token: 'fake-access-token',
      refresh_token: 'fake-refresh-token',
      user: { id: 'user-123', phone: '+919999999999', email: null },
    })
  ),
];
```

**Dynamic override for error states:**
```typescript
import { server } from '../mocks/server';
import { http, HttpResponse } from 'msw';

it('shows empty state when feed returns no merchants', async () => {
  server.use(
    http.get('*/api/v1/feed/nearby', () =>
      HttpResponse.json({ merchants: [], cursor: null })
    )
  );
  // render FeedScreen and assert empty state UI
});

it('shows error banner on server failure', async () => {
  server.use(
    http.get('*/api/v1/merchants', () =>
      HttpResponse.json({ error: 'internal error' }, { status: 500 })
    )
  );
  // render and assert error UI
});
```

**What to test with MSW:**
- Feed screen renders merchant cards from real API data via TanStack Query
- Order form submission (success + validation error)
- Auth flow (send OTP → verify → redirect to feed)
- Error states (500 responses, network failures)
- Loading skeletons and empty feed states
- Optimistic updates and cache invalidation on order placement

---

### E2E Tests (Maestro)

**Stack**: Maestro CLI (standalone — zero project dependencies)

Maestro is a black-box mobile UI testing framework. YAML-based, ~1% flakiness, no native modules.

**Why Maestro over Detox:**
- Zero project setup (standalone CLI, no native module changes)
- YAML syntax (non-engineers can write tests)
- Framework-agnostic (RN, Flutter, native)
- Detox requires complex Xcode/Gradle config

**File structure:**
```
e2e/maestro/
├── login-flow.yaml            # Phone OTP login
├── browse-feed-flow.yaml      # Browse nearby merchants
├── place-order-flow.yaml      # View merchant → select service → place order
├── view-merchant-flow.yaml    # Merchant profile + reviews
└── config.yaml
```

**Login flow (OTP):**
```yaml
# e2e/maestro/login-flow.yaml
appId: com.localstore.app
---
- launchApp
- tapOn: "Continue with Phone"
- inputText: "+919999999999"
- tapOn: "Send OTP"
- assertVisible: "Enter the code"
# OTP entered separately (07b pattern) to avoid timing mismatch
```

**Browse feed flow:**
```yaml
# e2e/maestro/browse-feed-flow.yaml
appId: com.localstore.app
---
- launchApp
- assertVisible: "Nearby Services"
- tapOn:
    id: "search-bar"
- inputText: "plumber"
- assertVisible: "plumber"
- tapOn:
    id: "category-filter-electrician"
- assertVisible: "electrician"
```

**Place order flow:**
```yaml
# e2e/maestro/place-order-flow.yaml
appId: com.localstore.app
---
- launchApp
- tapOn:
    id: "merchant-card-0"
- assertVisible: "Services"
- tapOn:
    id: "service-book-button-0"
- assertVisible: "Schedule"
- tapOn: "Confirm Order"
- assertVisible: "Order Placed"
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

**Prerequisites**: app must be running on a simulator/emulator. Maestro uses the device accessibility layer.

---

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

**Test file structure:**
```
backend/tests/
├── conftest.py                # Auth override, Supabase mock fixtures
├── factories.py               # make_merchant, make_order, make_review, make_service
├── test_auth.py
├── test_merchants.py
├── test_services.py
├── test_feed.py
├── test_search.py
├── test_storage.py
├── test_orders.py
├── test_payments.py
├── test_chat.py
├── test_reviews.py
└── test_health.py
```

**`conftest.py` — auth + Supabase mocking:**
```python
import pytest
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient
from app.main import app
from app.core.auth import get_current_user

FAKE_USER = {
    "id": "user-123",
    "email": "test@example.com",
    "phone": "+919999999999",
    "token": "fake-token",
}

@pytest.fixture()
def mock_supabase():
    mock_client = MagicMock()
    with (
        patch("app.core.supabase.get_supabase", return_value=mock_client),
        patch("app.api.v1.merchants.get_supabase", return_value=mock_client),
        patch("app.api.v1.orders.get_supabase", return_value=mock_client),
        patch("app.api.v1.feed.get_supabase", return_value=mock_client),
        patch("app.api.v1.payments.get_supabase", return_value=mock_client),
    ):
        yield mock_client

@pytest.fixture()
def authenticated_client(mock_supabase):
    app.dependency_overrides[get_current_user] = lambda: FAKE_USER
    with TestClient(app) as client:
        yield client
    app.dependency_overrides.clear()
```

**Factory functions:**
```python
# tests/factories.py
from faker import Faker
fake = Faker()

def make_merchant(**overrides):
    return {
        "id": overrides.get("id", str(fake.uuid4())),
        "owner_id": overrides.get("owner_id", str(fake.uuid4())),
        "business_name": overrides.get("business_name", fake.company()),
        "category": overrides.get("category", "plumber"),
        "city": overrides.get("city", "Hyderabad"),
        "lat": overrides.get("lat", 17.385),
        "lng": overrides.get("lng", 78.4867),
        "rating_avg": overrides.get("rating_avg", 4.5),
        "rating_count": overrides.get("rating_count", 10),
        "is_available": overrides.get("is_available", True),
        "created_at": overrides.get("created_at", fake.iso8601()),
    }

def make_service(merchant_id=None, **overrides):
    return {
        "id": overrides.get("id", str(fake.uuid4())),
        "merchant_id": merchant_id or str(fake.uuid4()),
        "name": overrides.get("name", fake.bs()),
        "price": overrides.get("price", 500.0),
        "unit": overrides.get("unit", "per visit"),
        "is_active": overrides.get("is_active", True),
        "created_at": overrides.get("created_at", fake.iso8601()),
    }

def make_order(user_id=None, merchant_id=None, **overrides):
    return {
        "id": overrides.get("id", str(fake.uuid4())),
        "user_id": user_id or str(fake.uuid4()),
        "merchant_id": merchant_id or str(fake.uuid4()),
        "service_id": overrides.get("service_id", str(fake.uuid4())),
        "status": overrides.get("status", "pending"),
        "total_amount": overrides.get("total_amount", 500),
        "payment_status": overrides.get("payment_status", "unpaid"),
        "created_at": overrides.get("created_at", fake.iso8601()),
    }

def make_review(merchant_id=None, reviewer_id=None, **overrides):
    return {
        "id": overrides.get("id", str(fake.uuid4())),
        "merchant_id": merchant_id or str(fake.uuid4()),
        "reviewer_id": reviewer_id or str(fake.uuid4()),
        "order_id": overrides.get("order_id", str(fake.uuid4())),
        "rating": overrides.get("rating", 5),
        "comment": overrides.get("comment", fake.sentence()),
        "created_at": overrides.get("created_at", fake.iso8601()),
    }
```

**Razorpay webhook HMAC test:**
```python
# tests/test_payments.py
import hmac, hashlib

def make_razorpay_signature(payload: str, secret: str) -> str:
    return hmac.new(
        secret.encode(), payload.encode(), hashlib.sha256
    ).hexdigest()

def test_webhook_valid_hmac(client, mock_supabase):
    payload = '{"event":"payment.captured","payload":{"payment":{"entity":{"id":"pay_123"}}}}'
    secret = "test-webhook-secret"
    sig = make_razorpay_signature(payload, secret)

    with patch("app.api.v1.payments.RAZORPAY_WEBHOOK_SECRET", secret):
        response = client.post(
            "/api/v1/payments/webhook",
            content=payload,
            headers={
                "Content-Type": "application/json",
                "X-Razorpay-Signature": sig,
            },
        )
    assert response.status_code == 200

def test_webhook_invalid_hmac(client):
    response = client.post(
        "/api/v1/payments/webhook",
        json={"event": "payment.captured"},
        headers={"X-Razorpay-Signature": "bad-signature"},
    )
    assert response.status_code == 400
```

**What to test per module:**

| Module | Key test cases |
|--------|----------------|
| `test_auth.py` | send OTP (200), verify OTP (200 + tokens), missing phone (422), invalid OTP (401) |
| `test_merchants.py` | list, get by ID (200), not found (404), unauthorized (401) |
| `test_services.py` | list by merchant, create (merchant-only), update, delete |
| `test_feed.py` | nearby with lat/lng, missing coords (422), pagination cursor |
| `test_search.py` | keyword search, category filter, empty results |
| `test_orders.py` | create order (merchant_id derived server-side), list, status update |
| `test_payments.py` | Razorpay webhook HMAC valid + invalid, verify payment, refund |
| `test_chat.py` | list threads, send message, mark read (`read_by_user` vs `read_by_merchant`) |
| `test_reviews.py` | create (requires completed order), list by merchant, cannot review twice |

---

### Integration Tests (Live Supabase)

**Stack**: pytest + httpx + real local Supabase instance

Integration tests hit a running backend connected to real Supabase. They auto-skip when infrastructure is unavailable.

**Test file structure:**
```
backend/tests/integration/
├── conftest.py                # Real Supabase, test user lifecycle
├── test_auth_integration.py
├── test_merchants_integration.py
├── test_feed_integration.py   # PostGIS geo queries
├── test_storage_integration.py
├── test_orders_integration.py
└── test_payments_integration.py  # HMAC mock against live backend
```

**Skip markers:**
```python
requires_supabase = pytest.mark.skipif(
    not _supabase_reachable(), reason="Supabase not running"
)
requires_backend = pytest.mark.skipif(
    not _backend_reachable(), reason="Backend not running"
)
requires_infra = pytest.mark.skipif(
    not (_supabase_reachable() and _backend_reachable()),
    reason="Full infra not running"
)
```

**Test user lifecycle:**
- Creates a unique test user per session via Supabase Admin API
- Uses `email_confirm: True` to bypass email verification
- All test data scoped to that user; cleaned up in session teardown

**PostGIS geo query integration test:**
```python
# tests/integration/test_feed_integration.py
@requires_infra
def test_nearby_feed_returns_merchants_within_radius(auth_client):
    # Seed a merchant at known Hyderabad coordinates
    # lat=17.385, lng=78.4867 (Banjara Hills)
    response = auth_client.get(
        "/api/v1/feed/nearby",
        params={"lat": 17.385, "lng": 78.4867, "radius_km": 5},
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data["merchants"]) >= 1
    # Merchant at 17.390, 78.490 should appear; one at 28.6 (Delhi) should not
    ids = [m["id"] for m in data["merchants"]]
    assert SEEDED_NEARBY_MERCHANT_ID in ids
    assert SEEDED_FAR_MERCHANT_ID not in ids
```

**What to test:**
- Full CRUD lifecycle (create → list → get → update → delete)
- RLS enforcement (user cannot modify another user's merchant/order)
- PostGIS: nearby feed returns correct merchants within radius
- Payment webhook HMAC against live backend (mocked Razorpay secret)
- Auth: OTP send + verify with real Supabase GoTrue / Twilio
- Storage: upload, download, delete with real bucket policies

**Running:**
```bash
# Start infrastructure
supabase start
uvicorn app.main:app --reload

# Run integration tests only
cd backend && pytest tests/integration/ -v

# Run unit tests only (no infra needed)
cd backend && pytest tests/ --ignore=tests/integration/ -v
```

---

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

---

## Coverage

### Frontend
```bash
npx jest --coverage
# Configure minimum in jest.config.js:
# coverageThreshold: { global: { branches: 80, functions: 80, lines: 80 } }
```

### Backend
```bash
pytest --cov=app --cov-report=term-missing --cov-fail-under=80
```

---

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

---

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
      - run: cd backend && uv sync --extra test && pytest --ignore=tests/integration/ --cov=app --cov-fail-under=80

  e2e:
    runs-on: macos-latest  # iOS simulator required for Maestro
    needs: [frontend-unit, backend-unit]
    steps:
      - uses: actions/checkout@v4
      - run: curl -Ls https://get.maestro.mobile.dev | bash
      - run: # start app + backend, then: maestro test e2e/maestro/
```

---

## Key Gotchas

- Use `msw/native` NOT `msw/node` — React Native has no Node `http` module.
- MSW requires `react-native-url-polyfill` + `fast-text-encoding` polyfills (runtime deps, bundled into production app).
- `POST /orders` request body must NOT include `merchant_id` — server derives it from `service_id`.
- `POST /payments/webhook` has no auth header — excluded from auth middleware, validated by Razorpay HMAC.
- `payment_events` table has RLS enabled but NO user-facing policies — service role only; never grant user access.
- `chat_messages.read_by_user` and `read_by_merchant` are separate booleans (not a single `is_read`).
- Never put test files inside `src/app/` — Expo Router treats every file there as a route.
- Integration tests auto-skip when Supabase/backend is unreachable; no hard failure in development.

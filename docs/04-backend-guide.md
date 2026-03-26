# Backend Guide

## FastAPI Application Structure

```
backend/app/
├── main.py              # App factory, CORS, health endpoint, mount router
├── api/v1/
│   ├── router.py        # Aggregates all v1 route modules
│   ├── auth.py          # POST /signup, /login, /refresh, /logout
│   ├── notes.py         # CRUD /rooms, /rooms/{id}/messages
│   └── storage.py       # POST /upload, GET /download, DELETE /delete
├── core/
│   ├── config.py        # Settings (pydantic-settings, reads .env)
│   ├── auth.py          # get_current_user dependency
│   └── supabase.py      # Client factory functions
└── schemas/
    ├── auth.py          # LoginRequest, SignUpRequest, AuthResponse
    ├── notes.py         # RoomCreate, RoomResponse, MessageCreate, MessageResponse
    └── storage.py       # File upload/download models
```

## Authentication Flow

### `core/auth.py` — Dependency Injection

```python
async def get_current_user(authorization: str = Header(...)) -> dict:
    token = authorization.replace("Bearer ", "")
    # Validates token against Supabase Auth
    # Returns { "id": "uuid", "email": "...", "token": "..." }
```

Every protected route declares `user=Depends(get_current_user)`.

### `core/supabase.py` — Client Factory

Two factory functions:
- `get_supabase()` → service role client (admin operations: signup, user management)
- `get_user_supabase(token)` → user-scoped client (inherits RLS context from JWT)

### Auth Endpoints (`api/v1/auth.py`)

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/v1/auth/signup` | POST | None | Create user via Supabase Auth |
| `/api/v1/auth/login` | POST | None | Sign in, returns access + refresh tokens |
| `/api/v1/auth/refresh` | POST | None | Exchange refresh token for new access token |
| `/api/v1/auth/logout` | POST | Bearer | Invalidate session |

## API Endpoints

### Rooms

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/v1/rooms` | GET | Bearer | List all rooms |
| `/api/v1/rooms` | POST | Bearer | Create room `{ "name": "..." }` |
| `/api/v1/rooms/{id}` | GET | Bearer | Get room by ID |
| `/api/v1/rooms/{id}` | PATCH | Bearer | Update room name |
| `/api/v1/rooms/{id}` | DELETE | Bearer | Delete room (creator only via RLS) |

### Messages

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/v1/rooms/{id}/messages` | GET | Bearer | List messages (paginated, `?limit=50&before=cursor`) |
| `/api/v1/rooms/{id}/messages` | POST | Bearer | Send message `{ "content": "...", "image_path?": "..." }` |
| `/api/v1/rooms/{id}/messages/{msg_id}` | PATCH | Bearer | Edit message (own only via RLS) |
| `/api/v1/rooms/{id}/messages/{msg_id}` | DELETE | Bearer | Delete message (own only via RLS) |

### Storage

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/v1/storage/upload` | POST | Bearer | Upload file (multipart form) |
| `/api/v1/storage/download/{path}` | GET | Bearer | Get signed download URL |
| `/api/v1/storage/delete/{path}` | DELETE | Bearer | Delete file |

### Health

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/health` | GET | None | Returns `{ "status": "ok" }` |

## Configuration (`core/config.py`)

```python
class Settings(BaseSettings):
    debug: bool = False
    supabase_url: str
    supabase_publishable_default_key: str  # anon key
    supabase_secret_default_key: str       # service role key
    cors_origins: list[str] = ["http://localhost:8081"]

    model_config = SettingsConfigDict(env_file=".env")
```

Supports both new Supabase key names (`SUPABASE_PUBLISHABLE_DEFAULT_KEY`) and legacy (`SUPABASE_ANON_KEY`).

## Deployment

### Dockerfile (multi-stage with uv)

```dockerfile
# Builder: install deps with uv
FROM python:3.12-slim AS builder
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen

# Runtime: copy venv + app code
FROM python:3.12-slim
COPY --from=builder /app/.venv .venv
COPY app/ app/
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### docker-compose.yml

```yaml
services:
  backend:
    build: ./backend
    ports: ["8000:8000"]
    env_file: ./backend/.env
    volumes: ["./backend:/app"]  # Hot reload in dev
    command: uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

## CORS

Configured in `main.py`. Default origins: `http://localhost:8081` (Expo dev server), `http://localhost:19006` (Expo web). Override via `CORS_ORIGINS` env var (JSON array).

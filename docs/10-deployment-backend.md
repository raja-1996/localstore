# Backend Deployment — FastAPI on Linux Server

## Production Architecture

```
Internet
   │
   │ HTTPS (443)
   ▼
┌──────────────────────────────────────────┐
│  Cloudflare (CDN + DDoS)                 │
│  - Proxies Supabase Storage public URLs  │
│  - Caches portfolio/post/avatar images   │
└──────────────┬───────────────────────────┘
               │ HTTPS (443)
               ▼
┌──────────────────────────────────────────┐
│  Nginx                                   │
│  - TLS termination (Let's Encrypt)       │
│  - Rate limiting (OTP, voice, need-posts)│
│  - Proxy headers forwarding              │
└──────────────┬───────────────────────────┘
               │ HTTP (Unix socket)
               ▼
┌──────────────────────────────────────────┐
│  Gunicorn (process manager)              │
│  ┌─────────────┐  ┌─────────────┐       │
│  │ Uvicorn     │  │ Uvicorn     │  ...  │
│  │ Worker 1    │  │ Worker 2    │       │
│  └─────────────┘  └─────────────┘       │
└──────────────┬───────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────┐
│  Supabase Cloud                          │
│  Auth (GoTrue) · PostgreSQL + PostGIS    │
│  Storage (S3-compatible) · Realtime WS   │
└──────────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────┐
│  External Services                       │
│  Razorpay · Sarvam.ai · Expo Push        │
│  SMS/OTP (Twilio or MSG91)               │
└──────────────────────────────────────────┘
```

---

## 1. Docker Deployment

The existing Dockerfile uses a multi-stage build with `uv` for fast, reproducible installs.

### Dockerfile (existing — multi-stage with uv)

```dockerfile
# Stage 1: install dependencies
FROM python:3.12-slim AS builder
WORKDIR /app
COPY --from=ghcr.io/astral-sh/uv:latest /uv /bin/uv
COPY pyproject.toml uv.lock* ./
RUN uv sync --frozen --no-dev

# Stage 2: runtime image (no build tools)
FROM python:3.12-slim
WORKDIR /app
COPY --from=builder /app/.venv .venv
COPY app/ app/
ENV PATH="/app/.venv/bin:$PATH"
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### Override CMD for production (Gunicorn + Uvicorn workers)

The default Dockerfile CMD runs a single Uvicorn process, suitable for development.
For production, override CMD to use Gunicorn with multiple Uvicorn workers:

```bash
docker run -d \
  --name localstore-backend \
  --restart unless-stopped \
  -p 127.0.0.1:8000:8000 \
  --env-file ./backend/.env \
  localstore-backend \
  gunicorn app.main:app \
    --workers 4 \
    --worker-class uvicorn.workers.UvicornWorker \
    --bind 0.0.0.0:8000 \
    --timeout 120 \
    --access-logfile - \
    --error-logfile - \
    --log-level warning
```

### Docker Compose (production)

```yaml
# docker-compose.prod.yml
services:
  backend:
    build: ./backend
    restart: unless-stopped
    ports:
      - "127.0.0.1:8000:8000"
    env_file: ./backend/.env
    command: >
      gunicorn app.main:app
      --workers 4
      --worker-class uvicorn.workers.UvicornWorker
      --bind 0.0.0.0:8000
      --timeout 120
      --access-logfile -
      --error-logfile -
      --log-level warning
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 10s
```

```bash
# Build and start
docker compose -f docker-compose.prod.yml up -d

# View logs
docker compose -f docker-compose.prod.yml logs -f backend

# Zero-downtime redeploy
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d --no-deps backend
```

---

## 2. Cloud Deployment Options

### Railway

Railway auto-detects the Dockerfile and deploys on every push to `main`.

```bash
# Install Railway CLI
npm install -g @railway/cli

# Link to project
railway link

# Set environment variables
railway variables set SUPABASE_URL=https://xyz.supabase.co
railway variables set SUPABASE_SECRET_DEFAULT_KEY=eyJ...
railway variables set SUPABASE_PUBLISHABLE_DEFAULT_KEY=eyJ...
railway variables set CORS_ORIGINS='["https://localstore.app","https://api.localstore.app"]'
railway variables set RAZORPAY_WEBHOOK_SECRET=your_webhook_secret
railway variables set DEBUG=false

# Deploy
railway up
```

- Provides a managed HTTPS endpoint (no Nginx setup needed).
- Add a custom domain in the Railway dashboard.
- Rate limiting must still be done in code (no Nginx layer).

### Render

```yaml
# render.yaml
services:
  - type: web
    name: localstore-backend
    runtime: docker
    dockerfilePath: ./backend/Dockerfile
    dockerCommand: >
      gunicorn app.main:app
      --workers 4
      --worker-class uvicorn.workers.UvicornWorker
      --bind 0.0.0.0:$PORT
    envVars:
      - key: DEBUG
        value: false
      - key: SUPABASE_URL
        sync: false
      - key: SUPABASE_SECRET_DEFAULT_KEY
        sync: false
      - key: SUPABASE_PUBLISHABLE_DEFAULT_KEY
        sync: false
      - key: CORS_ORIGINS
        value: '["https://localstore.app"]'
      - key: RAZORPAY_WEBHOOK_SECRET
        sync: false
    healthCheckPath: /health
```

### Fly.io

```toml
# fly.toml
app = "localstore-backend"
primary_region = "bom"  # Mumbai (closest to India)

[build]
  dockerfile = "backend/Dockerfile"

[build.args]
  CMD = "gunicorn app.main:app --workers 4 --worker-class uvicorn.workers.UvicornWorker --bind 0.0.0.0:8080"

[http_service]
  internal_port = 8080
  force_https = true
  auto_stop_machines = false
  auto_start_machines = true

[[vm]]
  cpu_kind = "shared"
  cpus = 2
  memory_mb = 1024
```

```bash
flyctl launch --no-deploy
flyctl secrets set SUPABASE_URL=... SUPABASE_SECRET_DEFAULT_KEY=... RAZORPAY_WEBHOOK_SECRET=...
flyctl deploy
```

### AWS ECS (Fargate)

1. Push Docker image to ECR:
   ```bash
   aws ecr get-login-password | docker login --username AWS --password-stdin $ECR_URI
   docker build -t localstore-backend ./backend
   docker tag localstore-backend:latest $ECR_URI/localstore-backend:latest
   docker push $ECR_URI/localstore-backend:latest
   ```
2. Create ECS Task Definition with container port 8000, ENV vars from AWS Secrets Manager.
3. Create ECS Service with ALB target group.
4. ALB handles TLS termination — no Nginx required.
5. Set ALB health check path to `/health`.

---

## 3. Nginx Reverse Proxy

### Rate Limiting — Critical Security Requirement

Three endpoints must be rate-limited to prevent cost overruns:

| Endpoint | Risk | Limit | Key |
|----------|------|-------|-----|
| `POST /api/v1/auth/otp/send` | SMS budget exhaustion | 3 req/min | per IP |
| `POST /api/v1/voice/search` | Sarvam.ai API cost spike | 5 req/min | per user |
| `POST /api/v1/need-posts` | Push notification spam to merchants | 2 req/min | per user |

### Full Nginx Configuration

```nginx
# /etc/nginx/sites-available/localstore-backend

# ── Rate limit zones ──────────────────────────────────────────────────────────
# Zone 1: OTP send — keyed by client IP; 10 MB state (≈160 K IPs)
limit_req_zone $binary_remote_addr
    zone=otp_send:10m
    rate=3r/m;

# Zone 2: Voice search — keyed by JWT sub extracted from header
# Falls back to remote_addr if header is missing (unauthenticated reqs → 401 anyway)
map $http_authorization $voice_key {
    default  $binary_remote_addr;
    "~Bearer\s+(?P<tok>[A-Za-z0-9._-]+)"  $tok;
}
limit_req_zone $voice_key
    zone=voice_search:10m
    rate=5r/m;

# Zone 3: Need-posts — keyed by same JWT token variable
limit_req_zone $voice_key
    zone=need_posts:10m
    rate=2r/m;

# ── Upstream ──────────────────────────────────────────────────────────────────
upstream localstore_backend {
    server unix:/run/gunicorn/localstore.sock fail_timeout=0;
    # OR for Docker: server 127.0.0.1:8000 fail_timeout=0;
}

# ── HTTP → HTTPS redirect ─────────────────────────────────────────────────────
server {
    listen 80;
    server_name api.localstore.app;
    return 301 https://$host$request_uri;
}

# ── HTTPS ─────────────────────────────────────────────────────────────────────
server {
    listen 443 ssl http2;
    server_name api.localstore.app;

    # SSL (populated by Certbot)
    ssl_certificate     /etc/letsencrypt/live/api.localstore.app/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.localstore.app/privkey.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         HIGH:!aNULL:!MD5;
    ssl_session_cache   shared:SSL:10m;
    ssl_session_timeout 10m;

    # Security headers
    add_header X-Frame-Options DENY always;
    add_header X-Content-Type-Options nosniff always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Body size (portfolio image uploads up to Supabase Storage 50 MB limit)
    client_max_body_size 52M;

    # ── Rate-limited endpoints ───────────────────────────────────────────────

    # OTP send: 3 req/min per IP; burst=2 (allows brief burst, then strict)
    location = /api/v1/auth/otp/send {
        limit_req zone=otp_send burst=2 nodelay;
        limit_req_status 429;

        proxy_pass         http://localstore_backend;
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
    }

    # Voice search: 5 req/min per user token
    location = /api/v1/voice/search {
        limit_req zone=voice_search burst=3 nodelay;
        limit_req_status 429;

        proxy_pass         http://localstore_backend;
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_read_timeout 30s;  # STT can be slow
    }

    # Need-posts: 2 req/min per user token
    location = /api/v1/need-posts {
        limit_req zone=need_posts burst=1 nodelay;
        limit_req_status 429;

        proxy_pass         http://localstore_backend;
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
    }

    # ── Razorpay webhook (no auth header, must be publicly accessible) ───────
    location = /api/v1/payments/webhook {
        proxy_pass         http://localstore_backend;
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        # Preserve raw body for HMAC signature verification
        proxy_set_header   Content-Type $content_type;
    }

    # ── Health check (no logging) ────────────────────────────────────────────
    location = /health {
        proxy_pass http://localstore_backend;
        access_log off;
        proxy_set_header Host $host;
    }

    # ── All other API routes ─────────────────────────────────────────────────
    location / {
        proxy_pass         http://localstore_backend;
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;

        # WebSocket support (Supabase Realtime connects directly from app,
        # but keep for any future WS routes)
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection "upgrade";

        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout    60s;
        proxy_read_timeout    60s;
    }

    # Block common attack paths
    location ~ /\.              { deny all; }
    location ~ ^/(wp-admin|phpMyAdmin|\.env) { return 444; }
}
```

```bash
# Enable and test
sudo ln -s /etc/nginx/sites-available/localstore-backend \
           /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## 4. CORS Production Configuration

**Critical (A2): Never use `*` for `allow_origins` in production.**

CORS is configured via the `CORS_ORIGINS` environment variable, which populates
`settings.cors_origins` and is passed directly to FastAPI's `CORSMiddleware`.

### Exact production domains

```bash
# .env (production)
CORS_ORIGINS=["https://localstore.app","https://www.localstore.app","https://merchant.localstore.app"]
```

- Include only the explicit domains your Expo app uses.
- Expo Go / development builds call from `localhost:8081` — **never** add `localhost` to production CORS.
- OTA update URLs do not make CORS requests; they do not need to be listed.
- `POST /payments/webhook` (Razorpay) originates server-to-server — it does NOT rely on CORS; it uses HMAC verification instead.

### FastAPI middleware reference (app/main.py)

```python
from app.core.config import settings
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,  # exact list — never ["*"] in prod
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)
```

---

## 5. CDN Setup — Cloudflare in Front of Supabase Storage

**Critical (D1): Public portfolio/post images must be served via CDN.**

Without a CDN, every image request hits Supabase Storage directly — increasing
latency for India users and consuming Supabase egress bandwidth.

### Storage bucket strategy

| Bucket | Visibility | URL type | CDN cacheable |
|--------|-----------|----------|---------------|
| `merchant-avatars` | Public | Unsigned public URL | Yes |
| `portfolio-images` | Public | Unsigned public URL | Yes |
| `post-media` | Public | Unsigned public URL | Yes |
| `chat-attachments` | Private | Signed URL (short TTL) | No |
| `video-intros` | Public | Unsigned public URL | Yes |
| `voice-uploads` | Private | Signed URL (short TTL) | No |

**Unsigned URLs** are used for public buckets so Cloudflare can cache them
(signed URLs contain expiry parameters — cache-busting every request).

### Cloudflare configuration

**Step 1 — Point your domain to Cloudflare:**

1. Add your domain to Cloudflare and update nameservers.
2. Create a CNAME record:
   ```
   media.localstore.app  CNAME  your-project.supabase.co  (Proxied: ON)
   ```

**Step 2 — Create a Cloudflare Transform Rule to rewrite the origin:**

In Cloudflare dashboard → Rules → Transform Rules → URL Rewrite:
```
If: hostname equals "media.localstore.app"
Then: Rewrite URL path → Dynamic
      concat("/storage/v1/object/public", http.request.uri.path)
Origin: https://your-project.supabase.co
```

**Step 3 — Cache Rules:**

```
If: hostname = "media.localstore.app"
    AND request.uri.path matches "^/(portfolio-images|post-media|merchant-avatars|video-intros)/"
Cache TTL: 30 days (Edge) / 1 day (Browser)
```

**Step 4 — Use the CDN URL in the app:**

```bash
# .env (backend)
SUPABASE_CDN_BASE=https://media.localstore.app
```

Construct public image URLs as:
```
https://media.localstore.app/portfolio-images/merchant-uuid/photo.webp
```
instead of:
```
https://your-project.supabase.co/storage/v1/object/public/portfolio-images/...
```

**Private buckets** (`chat-attachments`, `voice-uploads`) always use Supabase
signed URLs with a short TTL (e.g., 300 seconds) and are **not** routed via CDN.

---

## 6. Environment Variables — Production

```bash
# /home/deploy/localstore/backend/.env
# Permissions: chmod 600; owned by deploy user; never commit to git

# ── App ───────────────────────────────────────────────────────────────────────
DEBUG=false

# ── Supabase ──────────────────────────────────────────────────────────────────
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_PUBLISHABLE_DEFAULT_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SECRET_DEFAULT_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# ── CORS (exact production domains — never use * ) ────────────────────────────
CORS_ORIGINS=["https://localstore.app","https://www.localstore.app"]

# ── CDN ───────────────────────────────────────────────────────────────────────
SUPABASE_CDN_BASE=https://media.localstore.app

# ── Payments ──────────────────────────────────────────────────────────────────
RAZORPAY_KEY_ID=rzp_live_...
RAZORPAY_KEY_SECRET=...
RAZORPAY_WEBHOOK_SECRET=...   # HMAC-SHA256 key from Razorpay dashboard

# ── Push Notifications ────────────────────────────────────────────────────────
# Expo push tokens — no secret needed (Expo handles FCM/APNs credentials)

# ── Voice / AI (MVP 6) ────────────────────────────────────────────────────────
SARVAM_API_KEY=...
LLM_API_KEY=sk-...             # or key for Gemini
LLM_PROVIDER=openai            # or gemini

# ── SMS / OTP ─────────────────────────────────────────────────────────────────
# Configured in Supabase dashboard (Twilio/MSG91), not in backend .env
```

**Security rules:**
- `chmod 600 .env`; `chown deploy:deploy .env`
- `SUPABASE_SECRET_DEFAULT_KEY` (service role) must never be exposed to the frontend.
- Rotate `RAZORPAY_WEBHOOK_SECRET` immediately if leaked.

---

## 7. Server Setup and Deployment

### Server Requirements

| Resource | Minimum | Recommended |
|----------|---------|-------------|
| OS | Ubuntu 22.04+ | Ubuntu 24.04 LTS |
| CPU | 1 vCPU | 2+ vCPU |
| RAM | 1 GB | 2+ GB |
| Disk | 20 GB | 40 GB |
| Python | 3.12 | 3.12 |
| Domain | Required for SSL | — |

### Step 1 — Server setup

```bash
# Create non-root deploy user
adduser deploy
usermod -aG sudo deploy
su - deploy

# Install system packages
sudo apt update && sudo apt install -y \
    python3.12 python3.12-venv nginx certbot python3-certbot-nginx git curl

# Install uv
curl -LsSf https://astral.sh/uv/install.sh | sh
source ~/.bashrc
```

### Step 2 — Deploy code

```bash
cd /home/deploy
git clone https://github.com/your-org/localstore.git
cd localstore/backend

# Install production dependencies
uv sync --no-dev
uv pip install gunicorn

# Configure environment
cp .env.example .env
chmod 600 .env
# Edit .env with production values (see Section 6)
```

### Step 3 — Gunicorn configuration

```python
# /home/deploy/localstore/backend/gunicorn.conf.py

import multiprocessing

bind            = "unix:/run/gunicorn/localstore.sock"
workers         = multiprocessing.cpu_count() * 2 + 1
worker_class    = "uvicorn.workers.UvicornWorker"
timeout         = 120
graceful_timeout = 30
keepalive       = 5
accesslog       = "/var/log/gunicorn/access.log"
errorlog        = "/var/log/gunicorn/error.log"
loglevel        = "warning"
limit_request_line   = 8190
limit_request_fields = 100
proc_name       = "localstore-api"
preload_app     = True
```

Worker count formula: `(2 × CPU cores) + 1`. On a 2-core server: 5 workers.

### Step 4 — Systemd service

```ini
# /etc/systemd/system/localstore.service

[Unit]
Description=LocalStore FastAPI (Gunicorn + Uvicorn)
After=network.target
Requires=gunicorn.socket

[Service]
User=deploy
Group=www-data
WorkingDirectory=/home/deploy/localstore/backend
RuntimeDirectory=gunicorn
EnvironmentFile=/home/deploy/localstore/backend/.env
ExecStart=/home/deploy/localstore/backend/.venv/bin/gunicorn \
    app.main:app -c gunicorn.conf.py
ExecReload=/bin/kill -s HUP $MAINPID
Restart=on-failure
RestartSec=5s
KillMode=mixed
StandardOutput=journal
StandardError=journal

# Security hardening
PrivateTmp=true
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=read-only
ReadWritePaths=/var/log/gunicorn /run/gunicorn

[Install]
WantedBy=multi-user.target
```

```bash
# Create directories
sudo mkdir -p /var/log/gunicorn /run/gunicorn
sudo chown deploy:www-data /var/log/gunicorn /run/gunicorn

# Enable and start
sudo systemctl daemon-reload
sudo systemctl enable localstore
sudo systemctl start localstore

# Verify
sudo systemctl status localstore
curl --unix-socket /run/gunicorn/localstore.sock http://localhost/health
```

### Deployment script (zero-downtime)

```bash
#!/bin/bash
# /home/deploy/deploy.sh

set -euo pipefail

APP_DIR="/home/deploy/localstore"
BRANCH="main"

echo "=== Pulling latest code ==="
cd "$APP_DIR"
git fetch origin "$BRANCH"
git reset --hard "origin/$BRANCH"

echo "=== Installing dependencies ==="
cd backend
uv sync --no-dev

echo "=== Applying migrations ==="
# supabase db push --linked  (run locally or in CI — not from this script)

echo "=== Reloading application (graceful) ==="
sudo systemctl reload localstore  # sends HUP → graceful worker restart

echo "=== Verifying health ==="
sleep 3
if curl -sf --unix-socket /run/gunicorn/localstore.sock \
        http://localhost/health > /dev/null; then
    echo "Deployment successful"
else
    echo "HEALTH CHECK FAILED — rolling back"
    git reset --hard HEAD~1
    uv sync --no-dev
    sudo systemctl restart localstore
    exit 1
fi
```

```bash
chmod +x /home/deploy/deploy.sh
```

---

## 8. SSL/TLS — Let's Encrypt via Certbot

```bash
# Obtain certificate (Certbot auto-modifies the Nginx config)
sudo certbot --nginx -d api.localstore.app

# Verify auto-renewal
sudo certbot renew --dry-run

# Renewal is automatic via systemd timer (check status)
sudo systemctl status certbot.timer
```

Certificates are valid for 90 days and renew automatically every 60 days.

For cloud providers (Railway, Render, Fly.io, AWS ECS):
- TLS is handled by the platform — Certbot is **not needed**.
- Ensure `HTTPS` is enforced in the platform dashboard.

---

## 9. Razorpay Webhook Endpoint

**The webhook must be publicly reachable and HMAC-verified.**

### Requirements

- URL: `POST https://api.localstore.app/api/v1/payments/webhook`
- **No `Authorization` header** — this endpoint is excluded from the auth middleware.
- Validated by Razorpay HMAC-SHA256 signature instead.
- Must be accessible from Razorpay's servers (not behind IP allowlist).
- Replay protection: verify `created_at` timestamp is within a 5-minute window.

### Register in Razorpay dashboard

1. Go to Razorpay Dashboard → Settings → Webhooks.
2. Add URL: `https://api.localstore.app/api/v1/payments/webhook`.
3. Select events: `payment.captured`, `payment.failed`, `refund.processed`.
4. Copy the generated **Webhook Secret** → set as `RAZORPAY_WEBHOOK_SECRET` in `.env`.

### FastAPI handler outline

```python
import hashlib, hmac, time
from fastapi import Request, HTTPException

@router.post("/payments/webhook")  # excluded from auth middleware
async def razorpay_webhook(request: Request):
    body = await request.body()
    received_sig = request.headers.get("X-Razorpay-Signature", "")

    # HMAC-SHA256 verification
    expected = hmac.new(
        settings.razorpay_webhook_secret.encode(),
        body,
        hashlib.sha256,
    ).hexdigest()
    if not hmac.compare_digest(expected, received_sig):
        raise HTTPException(status_code=400, detail="Invalid signature")

    payload = json.loads(body)

    # Replay protection — reject events older than 5 minutes
    event_time = payload.get("created_at", 0)
    if abs(time.time() - event_time) > 300:
        raise HTTPException(status_code=400, detail="Stale webhook")

    # Handle event...
    return {"status": "ok"}
```

### Nginx — no extra config needed

The webhook is handled by the general `location /` block. The dedicated block in
Section 3 above is an optional enhancement to ensure raw body passthrough.

---

## 10. Structured Logging

**Production should use JSON-formatted logs** for log aggregation tools
(Datadog, Grafana Loki, AWS CloudWatch, etc.).

### Gunicorn JSON logging

```python
# gunicorn.conf.py — add JSON access log format
access_log_format = json.dumps({
    "time":       "%(t)s",
    "method":     "%(m)s",
    "path":       "%(U)s",
    "status":     "%(s)s",
    "duration_ms": "%(D)s",
    "ip":         "%(h)s",
    "user_agent": "%(a)s",
})
```

### FastAPI structured logging middleware

```python
# app/core/logging.py
import logging, json, time
from fastapi import Request

logging.basicConfig(
    level=logging.WARNING,
    format="%(message)s",   # raw message only — JSON handles structure
)
logger = logging.getLogger("localstore")

async def structured_log_middleware(request: Request, call_next):
    start = time.time()
    response = await call_next(request)
    duration_ms = round((time.time() - start) * 1000, 2)

    logger.info(json.dumps({
        "method":      request.method,
        "path":        request.url.path,
        "status":      response.status_code,
        "duration_ms": duration_ms,
        "ip":          request.headers.get("X-Forwarded-For", request.client.host),
    }))
    return response
```

```python
# app/main.py
from app.core.logging import structured_log_middleware
app.middleware("http")(structured_log_middleware)
```

### Log shipping

```bash
# Systemd journal → JSON file
sudo journalctl -u localstore -o json-pretty -f

# Nginx logs
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log

# Gunicorn logs
tail -f /var/log/gunicorn/access.log
tail -f /var/log/gunicorn/error.log
```

### Log rotation

```
# /etc/logrotate.d/gunicorn
/var/log/gunicorn/*.log {
    daily
    rotate 14
    compress
    delaycompress
    missingok
    notifempty
    postrotate
        systemctl reload localstore
    endscript
}
```

---

## 11. Health Checks and Monitoring

### Health endpoint

`GET /health` returns `{"status": "ok"}` — no auth required.

Use for:
- Uptime monitors: UptimeRobot, Better Uptime, Freshping (set check interval: 1 min)
- Load balancer health check target
- Deployment verification (see deploy script in Section 7)
- Docker/ECS `healthcheck` directive

### Extended health check (optional)

```python
# Returns db connectivity status alongside app status
@app.get("/health")
async def health():
    try:
        supabase = get_supabase()
        supabase.table("profiles").select("id").limit(1).execute()
        db_status = "ok"
    except Exception:
        db_status = "degraded"
    return {"status": "ok", "db": db_status}
```

### Firewall (UFW)

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 'Nginx Full'  # ports 80 + 443
sudo ufw enable
sudo ufw status
```

**Do NOT expose port 8000.** Gunicorn binds to a Unix socket; only Nginx communicates with it.

---

## 12. Supabase — Production Checklist

1. Use a **dedicated Supabase project** for production (never share with dev/staging).
2. Apply all migrations: `supabase db push --linked`
3. Copy project URL and both keys into backend `.env`.
4. RLS enabled on all 16 tables (enforced in migrations).
5. `payment_events` has RLS with **no user-facing policies** — service role only.
6. Enable database backups (automatic on Pro plan; manual snapshots on Free).
7. Configure Auth → Phone OTP provider (Twilio or MSG91) in Supabase dashboard.
8. Realtime enabled on: `chat_messages`, `orders`, `posts`.
9. Storage buckets configured with correct public/private settings (see Section 5).

---

## 13. Pre-Deployment Checklist

### Backend

- [ ] `DEBUG=false`
- [ ] `CORS_ORIGINS` lists only exact production domains — no `*`, no `localhost`
- [ ] `.env` is `chmod 600`, owned by deploy user, never committed to git
- [ ] `RAZORPAY_WEBHOOK_SECRET` set and tested with Razorpay test events
- [ ] Rate limiting verified: OTP (3/min), voice (5/min), need-posts (2/min)
- [ ] Gunicorn worker count tuned to server CPU: `(2 × cores) + 1`
- [ ] Systemd service enabled and auto-starts on reboot
- [ ] Nginx config tested: `sudo nginx -t`
- [ ] SSL certificate obtained; auto-renewal verified: `certbot renew --dry-run`
- [ ] Firewall: only ports 22, 80, 443 open
- [ ] Log rotation configured
- [ ] Deployment script tested end-to-end including rollback path
- [ ] Health check endpoint returns 200 from external monitor

### CDN

- [ ] Cloudflare CNAME `media.localstore.app` proxied (orange cloud ON)
- [ ] Cache rules active for public buckets (portfolio-images, post-media, etc.)
- [ ] Private buckets (`chat-attachments`, `voice-uploads`) not routed via CDN
- [ ] `SUPABASE_CDN_BASE` env var set; app constructs public URLs from it

### Supabase

- [ ] Dedicated production project (not dev/staging)
- [ ] All migrations applied
- [ ] RLS enabled on all tables
- [ ] `payment_events` has no user-facing RLS policy (service role only)
- [ ] Service role key secured (only backend `.env` holds it)
- [ ] Phone OTP SMS provider configured and tested
- [ ] Realtime enabled on `chat_messages`, `orders`, `posts`
- [ ] Database backups enabled

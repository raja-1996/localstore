# Backend Deployment — FastAPI on Linux Server

## Production Architecture

```
Internet
   │
   │ HTTPS (443)
   ▼
┌──────────┐
│  Nginx   │  TLS termination, static files, rate limiting
│  (proxy) │
└────┬─────┘
     │ HTTP (Unix socket or 127.0.0.1:8000)
     ▼
┌──────────────┐
│  Gunicorn    │  Process manager — spawns/monitors workers
│  ┌────────┐  │
│  │Uvicorn │  │  Worker 1 (async)
│  │Worker  │  │
│  ├────────┤  │
│  │Uvicorn │  │  Worker 2 (async)
│  │Worker  │  │
│  ├────────┤  │
│  │  ...   │  │  Worker N
│  └────────┘  │
└──────────────┘
     │
     ▼
┌──────────────┐
│  Supabase    │  Hosted (supabase.com) or self-hosted
│  (cloud)     │
└──────────────┘
```

## Server Requirements

| Resource | Minimum | Recommended |
|----------|---------|-------------|
| OS | Ubuntu 22.04+ | Ubuntu 24.04 LTS |
| CPU | 1 vCPU | 2+ vCPU |
| RAM | 1 GB | 2+ GB |
| Disk | 20 GB | 40 GB |
| Python | 3.12 | 3.12 |
| Domain | Required for SSL | — |

## Step-by-Step Deployment

### 1. Server Setup

```bash
# Create non-root user (never run production as root)
adduser deploy
usermod -aG sudo deploy
su - deploy

# Install system dependencies
sudo apt update && sudo apt install -y python3.12 python3.12-venv nginx certbot python3-certbot-nginx git

# Install uv
curl -LsSf https://astral.sh/uv/install.sh | sh
source ~/.bashrc
```

### 2. Deploy Application Code

```bash
# Clone repo
cd /home/deploy
git clone https://github.com/your-org/your-app.git
cd your-app/backend

# Create virtualenv and install deps
uv sync --no-dev
uv pip install gunicorn

# Create .env with production values
cp .env.example .env
# Edit .env:
#   DEBUG=false
#   SUPABASE_URL=https://xyz.supabase.co
#   SUPABASE_PUBLISHABLE_DEFAULT_KEY=eyJ...
#   SUPABASE_SECRET_DEFAULT_KEY=eyJ...
#   CORS_ORIGINS=["https://yourapp.com"]
```

### 3. Gunicorn Configuration

```python
# /home/deploy/your-app/backend/gunicorn.conf.py

import multiprocessing

# Bind to Unix socket (Nginx communicates here)
bind = "unix:/run/gunicorn/fastapi.sock"

# Workers = (2 * CPU cores) + 1
workers = multiprocessing.cpu_count() * 2 + 1

# Uvicorn worker class for async support
worker_class = "uvicorn.workers.UvicornWorker"

# Timeouts
timeout = 120
graceful_timeout = 30
keepalive = 5

# Logging
accesslog = "/var/log/gunicorn/access.log"
errorlog = "/var/log/gunicorn/error.log"
loglevel = "warning"

# Security
limit_request_line = 8190
limit_request_fields = 100

# Process naming
proc_name = "fastapi-app"

# Preload app for faster worker startup (uses more memory)
preload_app = True
```

**Worker count formula**: `(2 * CPU_CORES) + 1`. For a 2-core server: 5 workers. Each Uvicorn worker handles many concurrent connections via async.

### 4. Systemd Service

```ini
# /etc/systemd/system/fastapi.service

[Unit]
Description=FastAPI Application (Gunicorn + Uvicorn)
After=network.target
Requires=gunicorn.socket

[Service]
User=deploy
Group=www-data
WorkingDirectory=/home/deploy/your-app/backend
RuntimeDirectory=gunicorn
EnvironmentFile=/home/deploy/your-app/backend/.env
ExecStart=/home/deploy/your-app/backend/.venv/bin/gunicorn app.main:app -c gunicorn.conf.py
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
# Create log and socket directories
sudo mkdir -p /var/log/gunicorn /run/gunicorn
sudo chown deploy:www-data /var/log/gunicorn /run/gunicorn

# Enable and start
sudo systemctl daemon-reload
sudo systemctl enable fastapi
sudo systemctl start fastapi

# Verify
sudo systemctl status fastapi
curl --unix-socket /run/gunicorn/fastapi.sock http://localhost/health
```

### 5. Nginx Configuration

```nginx
# /etc/nginx/sites-available/fastapi

upstream fastapi_app {
    server unix:/run/gunicorn/fastapi.sock fail_timeout=0;
}

server {
    listen 80;
    server_name api.yourapp.com;

    # Redirect HTTP → HTTPS (Certbot will add this)
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.yourapp.com;

    # SSL (Certbot will populate these)
    # ssl_certificate /etc/letsencrypt/live/api.yourapp.com/fullchain.pem;
    # ssl_certificate_key /etc/letsencrypt/live/api.yourapp.com/privkey.pem;

    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # Request limits
    client_max_body_size 50M;  # Match Supabase Storage limit

    # Proxy to Gunicorn
    location / {
        proxy_pass http://fastapi_app;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # WebSocket support (if needed for future features)
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Health check (no logging)
    location /health {
        proxy_pass http://fastapi_app;
        access_log off;
    }

    # Block common attack paths
    location ~ /\. { deny all; }
    location ~ ^/(wp-admin|wp-login|xmlrpc) { return 444; }
}
```

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/fastapi /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default

# Test and reload
sudo nginx -t
sudo systemctl reload nginx
```

### 6. SSL with Certbot (Let's Encrypt)

```bash
# Obtain certificate (auto-modifies Nginx config)
sudo certbot --nginx -d api.yourapp.com

# Verify auto-renewal
sudo certbot renew --dry-run

# Renewal runs automatically via systemd timer
sudo systemctl status certbot.timer
```

Certificates renew automatically every 60 days (valid for 90 days).

## Deployment Script

```bash
#!/bin/bash
# /home/deploy/deploy.sh — Zero-downtime deployment

set -euo pipefail

APP_DIR="/home/deploy/your-app"
BRANCH="main"

echo "=== Pulling latest code ==="
cd "$APP_DIR"
git fetch origin "$BRANCH"
git reset --hard "origin/$BRANCH"

echo "=== Installing dependencies ==="
cd backend
uv sync --no-dev

echo "=== Running migrations ==="
# If using Supabase hosted, migrations are applied via Supabase CLI or dashboard
# supabase db push --linked

echo "=== Restarting application ==="
sudo systemctl restart fastapi

echo "=== Verifying health ==="
sleep 2
if curl -sf http://localhost/health > /dev/null; then
    echo "Deployment successful"
else
    echo "HEALTH CHECK FAILED — rolling back"
    git reset --hard HEAD~1
    uv sync --no-dev
    sudo systemctl restart fastapi
    exit 1
fi
```

```bash
chmod +x /home/deploy/deploy.sh
```

## Environment Variables — Production

```bash
# /home/deploy/your-app/backend/.env

DEBUG=false
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_PUBLISHABLE_DEFAULT_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SECRET_DEFAULT_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
CORS_ORIGINS=["https://yourapp.com","https://www.yourapp.com"]
```

**Security**: `.env` must be `chmod 600` and owned by deploy user. Never commit to git.

## Monitoring & Logging

### Logs

```bash
# Application logs (systemd journal)
sudo journalctl -u fastapi -f

# Gunicorn access/error logs
tail -f /var/log/gunicorn/access.log
tail -f /var/log/gunicorn/error.log

# Nginx logs
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log
```

### Health Check

The `/health` endpoint returns `{"status": "ok"}`. Use this for:
- Uptime monitoring (UptimeRobot, Better Uptime, etc.)
- Load balancer health checks
- Deployment verification

### Log Rotation

```bash
# /etc/logrotate.d/gunicorn
/var/log/gunicorn/*.log {
    daily
    rotate 14
    compress
    delaycompress
    missingok
    notifempty
    postrotate
        systemctl reload fastapi
    endscript
}
```

## Firewall

```bash
# UFW (Uncomplicated Firewall)
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 'Nginx Full'  # 80 + 443
sudo ufw enable
sudo ufw status
```

**Do NOT expose port 8000** — Gunicorn binds to a Unix socket, only Nginx talks to it.

## Scaling

### Vertical (single server)

- Increase Gunicorn workers: `workers = (2 * CPU) + 1`
- Upgrade server CPU/RAM
- Add swap: `sudo fallocate -l 2G /swapfile`

### Horizontal (multiple servers)

- Run multiple servers behind a load balancer (AWS ALB, DigitalOcean LB, etc.)
- Each server runs the same Nginx + Gunicorn stack
- Supabase (hosted) handles database scaling
- Ensure `.env` is identical across servers
- Use shared file storage (S3) if needed for uploads

## Docker Alternative

If you prefer containerized deployment:

```bash
# Build production image
docker build -t fastapi-app ./backend

# Run with env file
docker run -d \
  --name fastapi \
  --restart unless-stopped \
  -p 127.0.0.1:8000:8000 \
  --env-file ./backend/.env \
  fastapi-app

# Put Nginx in front (on host) pointing to 127.0.0.1:8000
```

Or use Docker Compose:

```yaml
# docker-compose.prod.yml
services:
  backend:
    build: ./backend
    restart: unless-stopped
    ports:
      - "127.0.0.1:8000:8000"
    env_file: ./backend/.env
    command: gunicorn app.main:app -c gunicorn.conf.py --bind 0.0.0.0:8000
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 5s
      retries: 3
```

## Supabase — Production

For production, use **Supabase hosted** (supabase.com):

1. Create project at supabase.com
2. Apply migrations: `supabase db push --linked`
3. Copy project URL and keys to backend `.env`
4. Enable RLS on all tables (should already be in migrations)
5. Set up database backups (automatic on Pro plan)
6. Configure Auth providers (email, OAuth) in Supabase dashboard

## Pre-Deployment Checklist

### Backend

- [ ] `DEBUG=false` in production `.env`
- [ ] `CORS_ORIGINS` restricted to actual frontend domains
- [ ] `.env` file has `chmod 600`, owned by deploy user
- [ ] Gunicorn worker count tuned for server CPU
- [ ] Systemd service enabled and tested
- [ ] Nginx config tested (`nginx -t`)
- [ ] SSL certificate obtained and auto-renewal verified
- [ ] Firewall configured (only 22, 80, 443 open)
- [ ] Log rotation configured
- [ ] Health check endpoint verified
- [ ] Deployment script tested with rollback

### Supabase

- [ ] All migrations applied to production database
- [ ] RLS enabled on all tables
- [ ] Service role key secured (only backend has it)
- [ ] Anon/publishable key has minimal permissions
- [ ] Database backups enabled
- [ ] Auth email templates customized

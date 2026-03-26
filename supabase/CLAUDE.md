# supabase
Supabase local development configuration and SQL migrations for the project database.

- `config.toml` — local Supabase stack configuration (ports, auth settings, storage limits, realtime)
  - types: TOML config; key sections: `[project]`, `[api]`, `[db]`, `[studio]`, `[auth]`, `[auth.email]`, `[auth.sms]`, `[storage]`, `[realtime]`
  - gotcha: `enable_confirmations = false` for both email and SMS — email verification is disabled for local dev convenience; must enable for production
  - gotcha: `site_url = "http://localhost:8081"` (Expo dev server); update to production domain before deploying
  - env: sets local ports — API gateway 54321, PostgreSQL 54322, Studio 54323

- `migrations/` — SQL migration files applied via `supabase db push` or `supabase start` (see `migrations/CLAUDE.md`)

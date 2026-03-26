# Supabase Setup Guide

Complete checklist for setting up a new Supabase project and running all backend tests without issues.

---

## 1. Create a New Supabase Project

1. Go to [supabase.com](https://supabase.com) → New Project
2. Note your **Project Reference ID** (e.g. `yrrkacsvhvvkieznitmk` — visible in the project URL)
3. From **Project Settings → API**, copy:
   - `Project URL` → `SUPABASE_URL`
   - `anon public` key → `SUPABASE_PUBLISHABLE_DEFAULT_KEY`
   - `service_role` key → `SUPABASE_SECRET_DEFAULT_KEY`

---

## 2. Configure Local Credentials

Create `backend/.env.test` (already in `.gitignore` — never commit):

```
SUPABASE_URL=https://<your-ref>.supabase.co
SUPABASE_PUBLISHABLE_DEFAULT_KEY=<anon-key>
SUPABASE_SECRET_DEFAULT_KEY=<service-role-key>
```

Also create `backend/.env` for running the server locally (same values):

```
SUPABASE_URL=https://<your-ref>.supabase.co
SUPABASE_PUBLISHABLE_DEFAULT_KEY=<anon-key>
SUPABASE_SECRET_DEFAULT_KEY=<service-role-key>
```

---

## 3. Link the Supabase CLI

From the project root:

```bash
npx supabase login          # one-time browser auth
npx supabase link --project-ref <your-ref>
```

Verify it worked:

```bash
npx supabase projects list  # should show your project with ● (linked)
```

---

## 4. Push All Migrations

```bash
npx supabase db push
```

This applies all files in `supabase/migrations/` in order:

| File | What it creates |
|------|----------------|
| `001_initial_schema.sql` | `profiles` table, `todos` table, RLS policies, triggers |
| `002_add_push_token.sql` | `push_token` column on `profiles`, update RLS policy |
| `003_storage_policies.sql` | `uploads` storage bucket, storage RLS policies |

**Expected output:**
```
Applying migration 001_initial_schema.sql...
Applying migration 002_add_push_token.sql...
Applying migration 003_storage_policies.sql...
Finished supabase db push.
```

---

## 5. Supabase Dashboard Settings

### 5a. Disable Email Confirmation (required for integration tests)

Tests sign up real users and immediately log in. If email confirmation is enabled, login fails.

1. Dashboard → **Authentication → Providers → Email**
2. Toggle **Confirm email** → **OFF**
3. Save

### 5b. Verify Storage Bucket

After `db push`, the `uploads` bucket is created automatically by `003_storage_policies.sql`.

Verify: Dashboard → **Storage** → you should see an `uploads` bucket (private).

If it's missing, run the migration again or create it manually:
- Name: `uploads`
- Public: No

---

## 6. What the Migrations Create

### Tables & RLS

**`profiles`** — auto-created on signup via trigger
- RLS: any authenticated user can SELECT; users can only UPDATE their own row
- `push_token` column: users can only update their own

**`todos`**
- RLS: full CRUD restricted to own rows (`auth.uid() = user_id`)
- Index on `(user_id, created_at DESC)`
- Trigger: `updated_at` auto-updates on every UPDATE

### Storage

**`uploads` bucket** (private)
- RLS INSERT: users can only upload to `{user_id}/...` paths
- RLS SELECT: users can only download their own files
- RLS DELETE: users can only delete their own files (but see gotcha below)

> **Storage RLS DELETE gotcha:** Supabase Storage's `remove()` returns 204 even when RLS blocks the delete (SQL DELETE 0 rows is not an error). The file is NOT actually deleted — the test for this verifies the file still exists afterward, not the HTTP status code.

### Triggers

- `on_auth_user_created` — auto-inserts a row into `profiles` on new user signup
- `todos_updated_at` / `profiles_updated_at` — keeps `updated_at` current

---

## 7. Running Tests

### Unit tests (no Supabase needed)

```bash
cd backend
uv run pytest tests/ --ignore=tests/integration/ -v
```

Uses mocked Supabase — runs offline.

### Integration tests (requires live Supabase + `.env.test`)

```bash
cd backend
uv run pytest tests/integration/ -v
```

Auto-skips if Supabase is unreachable or `.env.test` is missing.

### All tests

```bash
cd backend
uv run pytest tests/ -v
```

**Expected results with a properly set-up project:**

| Suite | Tests | Result |
|-------|-------|--------|
| Unit (auth) | 19 | pass |
| Unit (todos) | 5 | pass |
| Unit (storage) | 17 | pass |
| Unit (notifications) | 7 | pass |
| Unit (health) | 1 | pass |
| Integration (auth) | 11 | pass |
| Integration (todos) | 19 | pass |
| Integration (storage) | 16 | pass |
| Integration (notifications) | 7 | pass |

---

## 8. Troubleshooting

### Integration tests skip with "Supabase not reachable"
- Check `SUPABASE_URL` in `backend/.env.test` is correct
- Verify the URL is reachable: `curl https://<your-ref>.supabase.co/rest/v1/`

### Upload fails with `new row violates row-level security policy`
- Storage RLS policies not applied
- Run `npx supabase db push` to apply `003_storage_policies.sql`
- Verify `uploads` bucket exists in Dashboard → Storage

### Login returns error after signup in integration tests
- Email confirmation is enabled
- Disable it: Dashboard → Authentication → Providers → Email → Confirm email → OFF

### `auth.admin.delete_user()` fails with "User not allowed"
- The `service_role` key in `.env.test` doesn't have admin privileges
- Ensure you're using the **service_role** key (not anon key) for `SUPABASE_SECRET_DEFAULT_KEY`

### `_bucket_exists()` returns False despite bucket existing
- `get_supabase()` is LRU-cached with stale credentials from unit test setup
- Fixed in `test_storage_integration.py` — the function clears the cache before checking
- If you see this, ensure `.env.test` is loaded before running integration tests

### Migrations fail with "already exists"
- The `ON CONFLICT (id) DO NOTHING` in `003_storage_policies.sql` handles the bucket
- For policy conflicts: drop old policies in Dashboard → Database → Policies, then re-push

---

## 9. Credentials Reference

| Variable | Where to find it |
|----------|-----------------|
| `SUPABASE_URL` | Project Settings → API → Project URL |
| `SUPABASE_PUBLISHABLE_DEFAULT_KEY` | Project Settings → API → anon public |
| `SUPABASE_SECRET_DEFAULT_KEY` | Project Settings → API → service_role |
| Project Reference ID | Project URL or `npx supabase projects list` |

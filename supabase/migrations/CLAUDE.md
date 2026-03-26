# supabase/migrations
SQL migration files applied in order by Supabase CLI (`supabase db push` / `supabase db reset`).

- `001_initial_schema.sql` — creates all tables, RLS policies, indexes, and triggers for the initial schema
  - side-effects: DB DDL — creates tables `profiles` and `todos`; enables RLS; creates 6 RLS policies; creates 1 index; creates 3 triggers; enables Realtime on `todos`
  - types:
    - `profiles {id UUID PK → auth.users, email TEXT, full_name TEXT, avatar_url TEXT, created_at, updated_at}` — auto-created on signup via trigger
    - `todos {id UUID PK, user_id UUID → auth.users, title TEXT NOT NULL, description TEXT DEFAULT '', image_path TEXT, is_completed BOOLEAN DEFAULT false, created_at, updated_at}`
  - gotcha: `profiles` has no INSERT policy — row is created by the `handle_new_user()` trigger (SECURITY DEFINER), not by app code
  - gotcha: `todos` RLS policies use `auth.uid() = user_id` — all 4 CRUD ops are user-scoped (users can only see and modify their own todos)
  - gotcha: `handle_new_user` trigger runs AFTER INSERT on `auth.users` — if trigger fails, user is created in auth but has no profile row
  - gotcha: `supabase_realtime` publication is enabled on `todos` — frontend can subscribe to `postgres_changes` on this table
  - pattern: all `updated_at` columns auto-update via shared `update_updated_at()` trigger function (BEFORE UPDATE)

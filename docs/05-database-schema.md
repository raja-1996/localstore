# Database Schema

## Supabase PostgreSQL

All tables use RLS (Row Level Security). Backend connects with user-scoped JWT so RLS policies are enforced server-side.

## Tables

### `profiles`

Extends `auth.users`. Auto-created via trigger on signup.

```sql
CREATE TABLE profiles (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email      TEXT,
  full_name  TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

**RLS Policies:**
- SELECT: any authenticated user can read all profiles
- UPDATE: users can only update their own profile (`auth.uid() = id`)

### `rooms`

Chat rooms.

```sql
CREATE TABLE rooms (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

**RLS Policies:**
- SELECT: any authenticated user
- INSERT: any authenticated user (auto-sets `created_by = auth.uid()`)
- UPDATE/DELETE: only creator (`auth.uid() = created_by`)

### `messages`

Messages within rooms.

```sql
CREATE TABLE messages (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id    UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES auth.users(id),
  content    TEXT NOT NULL,
  image_path TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

**RLS Policies:**
- SELECT: any authenticated user
- INSERT: any authenticated user (auto-sets `user_id = auth.uid()`)
- UPDATE/DELETE: only message author (`auth.uid() = user_id`)

### Indexes

```sql
CREATE INDEX idx_messages_room_created ON messages(room_id, created_at);
CREATE INDEX idx_messages_user ON messages(user_id);
```

## Triggers

- **`updated_at` auto-update**: Trigger on `rooms` and `messages` sets `updated_at = now()` on every UPDATE
- **Profile auto-create**: After INSERT on `auth.users`, creates matching `profiles` row

## Realtime

Supabase Realtime is enabled on the `messages` table. The frontend subscribes to `postgres_changes` events filtered by `room_id` for live updates.

## Migrations

Located in `supabase/migrations/`. Applied via `supabase db push` or automatically on `supabase start`.

## Local Development

```bash
supabase start          # Starts local Postgres, Auth, Storage, Realtime
supabase db reset       # Drops and re-applies all migrations
supabase migration new  # Creates new timestamped migration file
```

**Local ports:**
| Service | Port |
|---------|------|
| API Gateway | 54321 |
| PostgreSQL | 54322 |
| Studio (GUI) | 54323 |

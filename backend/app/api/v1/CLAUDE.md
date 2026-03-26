# v1/
FastAPI route handlers for all v1 API endpoints: auth, todos, and file storage.

- `router.py` — aggregates the three sub-routers; mounts them under `/auth`, `/todos`, `/storage`
  - exports: `v1_router` (APIRouter)
  - deps: `app.api.v1.auth`, `app.api.v1.todos`, `app.api.v1.storage`
  - side-effects: none (pure aggregation)

- `auth.py` — authentication endpoints: signup, login, phone OTP, token refresh, logout, account deletion
  - exports: `router` (APIRouter)
  - deps: `app.core.auth.get_current_user`, `app.core.supabase.get_supabase`, `app.core.supabase.get_user_supabase`, `app.schemas.auth.*`
  - side-effects: Supabase Auth API calls (sign_up, sign_in, sign_out, verify_otp, refresh_session, admin.delete_user)
  - gotcha: `POST /signup` returns empty tokens (not an error) when email confirmation is required by Supabase config; caller must handle `expires_in == 0`
  - gotcha: `DELETE /account` uses the service-role admin client to delete users, not the user-scoped client

- `todos.py` — CRUD endpoints for the `todos` Supabase table
  - exports: `router` (APIRouter)
  - deps: `app.core.auth.get_current_user`, `app.core.supabase.get_user_supabase`, `app.schemas.todos.TodoCreate`, `TodoUpdate`, `TodoResponse`
  - side-effects: DB reads/writes on Supabase `todos` table (RLS enforced via user-scoped client)
  - gotcha: uses `get_user_supabase(user["token"])` so Row Level Security is enforced automatically; never use the service-role client here
  - gotcha: `PATCH /{todo_id}` raises 400 if body contains no updatable fields (all None)

- `storage.py` — file upload/download/delete via Supabase Storage bucket `uploads`
  - exports: `router` (APIRouter)
  - deps: `app.core.auth.get_current_user`, `app.core.supabase.get_user_supabase`, `app.schemas.storage.UploadResponse`, `DownloadResponse`; stdlib `uuid`
  - side-effects: Supabase Storage API calls (upload, create_signed_url, remove); reads uploaded file into memory
  - gotcha: auto-generates path as `{user_id}/{uuid}.{ext}` when `path` form field is omitted; always scoped to user
  - gotcha: signed URLs expire in 3600 s; `download` does not return raw bytes — it returns a signed URL for client-side fetch
  - gotcha: `signed_url` extraction handles both attribute-style and dict-style Supabase SDK responses (SDK inconsistency)
  - gotcha: delete route is `DELETE /delete/{path}`, not `DELETE /{path}`

- `__init__.py` — empty package marker

## Endpoint Summary
| Method | Path | Auth | File |
|--------|------|------|------|
| POST | /auth/signup | no | auth.py |
| POST | /auth/login | no | auth.py |
| POST | /auth/phone/send-otp | no | auth.py |
| POST | /auth/phone/verify-otp | no | auth.py |
| POST | /auth/refresh | no | auth.py |
| POST | /auth/logout | Bearer | auth.py |
| DELETE | /auth/account | Bearer | auth.py |
| GET | /todos | Bearer | todos.py |
| POST | /todos | Bearer | todos.py |
| GET | /todos/{todo_id} | Bearer | todos.py |
| PATCH | /todos/{todo_id} | Bearer | todos.py |
| DELETE | /todos/{todo_id} | Bearer | todos.py |
| POST | /storage/upload | Bearer | storage.py |
| GET | /storage/download/{path} | Bearer | storage.py |
| DELETE | /storage/delete/{path} | Bearer | storage.py |

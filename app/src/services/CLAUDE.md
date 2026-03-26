# services
Thin API client wrappers — one module per backend resource domain.

- `auth-service.ts` — auth endpoints: signup, login, sendPhoneOtp, verifyPhoneOtp, refresh, logout, deleteAccount
  - exports: `authService` (default), `AuthResponse`
  - deps: `../lib/api`
  - types: `AuthResponse { access_token, refresh_token, token_type, expires_in, user: { id, email: string | null, phone: string | null } }`
  - side-effects: API calls to `/auth/*`
  - gotcha: does NOT persist tokens — token storage is the caller's responsibility (`auth-store.ts` handles this)

- `storage-service.ts` — file upload/download/delete via backend storage endpoints
  - exports: `storageService` (default)
  - deps: `../lib/api`
  - side-effects: API calls to `/storage/upload`, `/storage/download/:path`, `/storage/delete/:path`
  - gotcha: `upload` overrides `Content-Type` to `multipart/form-data`; caller must pass a valid `FormData` object

- `todos-service.ts` — full CRUD for todo items: list, get, create, update, delete
  - exports: `todosService` (default), `Todo`, `TodoCreate`, `TodoUpdate`
  - deps: `../lib/api`
  - types:
    - `Todo { id, user_id, title, description, image_path: string|null, is_completed, created_at, updated_at }`
    - `TodoCreate { title: string, description?: string }`
    - `TodoUpdate { title?, description?, is_completed?, image_path?: string|null }`
  - side-effects: API calls to `/todos` and `/todos/:id`

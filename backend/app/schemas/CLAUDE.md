# schemas/
Pydantic request/response models for all API endpoints — no business logic, no DB access.

- `__init__.py` — empty package marker; no exports
- `auth.py` — request/response models for all auth flows
  - exports: `SignUpRequest`, `LoginRequest`, `OTPRequest`, `OTPVerifyRequest`, `RefreshRequest`, `AuthResponse`
  - deps: `pydantic` (`BaseModel`, `EmailStr`)
  - types: `SignUpRequest {email: EmailStr, password: str}` | `LoginRequest {email: EmailStr, password: str}` | `OTPRequest {phone: str}` | `OTPVerifyRequest {phone: str, otp: str}` | `RefreshRequest {refresh_token: str}` | `AuthResponse {access_token, refresh_token, token_type="bearer", expires_in: int, user: dict}`
  - gotcha: `AuthResponse.user` is untyped `dict` — shape depends on Supabase response, not enforced here
- `todos.py` — request/response models for todo CRUD
  - exports: `TodoCreate`, `TodoUpdate`, `TodoResponse`
  - deps: `pydantic` (`BaseModel`), `datetime`
  - types: `TodoCreate {title: str, description: str=""}` | `TodoUpdate {title?, description?, is_completed?, image_path? — all Optional}` | `TodoResponse {id: str, user_id: str, title, description, image_path: str|None, is_completed: bool, created_at: datetime, updated_at: datetime}`
  - gotcha: `TodoUpdate` uses all-optional fields for partial PATCH — every field defaults to `None`
- `storage.py` — response models for file upload/download
  - exports: `UploadResponse`, `DownloadResponse`
  - deps: `pydantic` (`BaseModel`)
  - types: `UploadResponse {path: str, url: str}` | `DownloadResponse {url: str}`

## Key Patterns
- `*Request` suffix: inbound payloads (client-supplied fields only)
- `*Response` suffix: outbound payloads (includes server-generated fields like `id`, `created_at`)
- No ORM integration — plain `BaseModel`, no `model_config` with `from_attributes`
- `EmailStr` used in `auth.py` for validated email fields; not used elsewhere

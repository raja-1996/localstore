# API Reference

Base URL: `http://localhost:8000/api/v1`

All endpoints except auth and health require `Authorization: Bearer <access_token>` header.

## Auth

### POST `/auth/signup`

Create a new user account.

```json
// Request
{ "email": "user@example.com", "password": "SecurePass123!" }

// Response 200
{
  "access_token": "eyJ...",
  "refresh_token": "abc...",
  "token_type": "bearer",
  "expires_in": 3600,
  "user": { "id": "uuid", "email": "user@example.com" }
}
```

### POST `/auth/login`

Sign in with existing credentials. Same request/response shape as signup.

### POST `/auth/refresh`

```json
// Request
{ "refresh_token": "abc..." }

// Response 200 — same shape as login response with new tokens
```

### POST `/auth/logout`

Requires auth header. Invalidates the current session. Returns `204 No Content`.

## Rooms

### GET `/rooms`

List all rooms. Returns `Room[]`.

```json
// Response 200
[
  {
    "id": "uuid",
    "name": "General",
    "created_by": "user-uuid",
    "created_at": "2026-01-01T00:00:00Z",
    "updated_at": "2026-01-01T00:00:00Z"
  }
]
```

### POST `/rooms`

```json
// Request
{ "name": "New Room" }

// Response 201 — Room object
```

### GET `/rooms/{room_id}`

Returns single Room object. `404` if not found.

### PATCH `/rooms/{room_id}`

```json
// Request
{ "name": "Renamed Room" }

// Response 200 — updated Room object
// 400 if empty body, 404 if not found
```

### DELETE `/rooms/{room_id}`

Returns `204 No Content`. `404` if not found. Only creator can delete (RLS enforced).

## Messages

### GET `/rooms/{room_id}/messages`

Paginated message list, newest first.

Query params:
- `limit` (int, default 50) — max messages to return
- `before` (string, optional) — cursor for pagination (message ID)

```json
// Response 200
{
  "data": [
    {
      "id": "uuid",
      "room_id": "room-uuid",
      "user_id": "user-uuid",
      "content": "Hello world",
      "image_path": null,
      "created_at": "2026-01-01T00:00:00Z",
      "updated_at": "2026-01-01T00:00:00Z"
    }
  ],
  "has_more": false
}
```

### POST `/rooms/{room_id}/messages`

```json
// Request
{ "content": "Hello world", "image_path": "optional/path.jpg" }

// Response 201 — Message object
```

### PATCH `/rooms/{room_id}/messages/{message_id}`

```json
// Request
{ "content": "Edited message" }

// Response 200 — updated Message object
// 400 if empty body, 404 if not found
```

### DELETE `/rooms/{room_id}/messages/{message_id}`

Returns `204 No Content`. Only message author can delete (RLS enforced).

## Storage

### POST `/storage/upload`

Multipart form upload.

```
Content-Type: multipart/form-data
file: <binary>
path: "optional/custom/path.jpg"
```

```json
// Response 200
{ "path": "uploads/uuid-filename.jpg", "url": "https://..." }
```

### GET `/storage/download/{path}`

Returns signed download URL.

```json
// Response 200
{ "url": "https://signed-url..." }
```

### DELETE `/storage/delete/{path}`

Returns `204 No Content`.

## Health

### GET `/health`

No auth required.

```json
// Response 200
{ "status": "ok" }
```

## Error Responses

All errors follow this shape:

```json
// 401 Unauthorized
{ "detail": "Missing or invalid authorization header" }

// 404 Not Found
{ "detail": "Room not found" }

// 422 Validation Error (Pydantic)
{
  "detail": [
    { "loc": ["body", "name"], "msg": "Field required", "type": "missing" }
  ]
}

// 400 Bad Request
{ "detail": "No fields to update" }
```

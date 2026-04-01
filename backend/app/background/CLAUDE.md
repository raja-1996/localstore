# background/
FastAPI BackgroundTasks functions for fire-and-forget async operations.

## How Background Tasks Work
Route handlers pass `bg: BackgroundTasks` as a dependency, then call `bg.add_task(func, *args)` after the response is prepared. The task runs after the response is sent to the client.

```python
# Usage in route handler
@router.post("/chats/{thread_id}/messages")
async def send_message(body: MessageCreate, bg: BackgroundTasks, user=Depends(get_current_user)):
    message = insert_message(...)
    bg.add_task(push_tasks.send_chat_push, recipient_id, message.content[:100])
    return message
```

## Modules

- `push_tasks.py` — Push notification dispatch (Sprint 11+)
  - exports: `send_chat_push(thread_id, sender_id, message_preview)`, `send_post_push(merchant_id, merchant_name, post_preview)`
  - deps: `services/push_service.py`, `core/supabase.py`
  - triggers: after chat message insert, merchant post creation

- `cleanup_tasks.py` — Temporary file cleanup (MVP 6)
  - exports: `delete_voice_upload(bucket, path)`
  - deps: `core/supabase.py` (service-role client)
  - triggers: after voice search processing completes

## Limitations
- **No retry**: If the external service (Expo Push, Supabase Storage) is down, the task fails silently. FastAPI BackgroundTasks has no built-in retry mechanism.
- **Process-bound**: Tasks die if the worker process restarts mid-execution. Suitable for fast operations (~100ms) like push dispatch, not for long-running jobs.
- **Not a job queue**: For scheduled/recurring jobs (insights computation, leaderboard refresh, need_posts expiry), use Supabase `pg_cron` instead.

## Testing
Background task functions are plain Python functions — test them directly:
```python
# test_push_tasks.py
async def test_send_chat_push(mock_push_service):
    await push_tasks.send_chat_push("user-uuid", "Hello!")
    mock_push_service.send_push.assert_called_once()
```

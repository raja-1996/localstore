import logging

import httpx
from fastapi import APIRouter, Depends, HTTPException

from app.core.auth import get_current_user
from app.core.notifications import send_push_notification
from app.core.supabase import get_supabase, get_user_supabase
from app.schemas.notifications import (
    RegisterTokenRequest,
    RegisterTokenResponse,
    SendNotificationRequest,
    SendNotificationResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/register-token", response_model=RegisterTokenResponse)
async def register_token(
    request: RegisterTokenRequest,
    user: dict = Depends(get_current_user),
) -> RegisterTokenResponse:
    user_id = user["id"]
    supabase = get_user_supabase(user["token"])
    try:
        result = supabase.table("profiles").update({"push_token": request.token}).eq("id", user_id).execute()
        if not result.data:
            raise HTTPException(status_code=404, detail="Profile not found")
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Failed to register push token for user %s", user_id)
        raise HTTPException(status_code=500, detail="Failed to register push token")
    return RegisterTokenResponse(message="Token registered successfully")


# NOTE: no per-user authorization — any authenticated user can notify any other user.
@router.post("/send", response_model=SendNotificationResponse)
async def send_notification(
    request: SendNotificationRequest,
    user: dict = Depends(get_current_user),
) -> SendNotificationResponse:
    supabase = get_supabase()  # service-role client: bypasses RLS to look up recipient's token
    try:
        result = supabase.table("profiles").select("push_token").eq("id", request.to_user_id).execute()
        if not result.data or not result.data[0].get("push_token"):
            raise HTTPException(status_code=404, detail="User has no push token registered")
        token = result.data[0]["push_token"]
        await send_push_notification(token, request.title, request.body, request.data)
        return SendNotificationResponse(success=True, message="Notification sent")
    except HTTPException:
        raise
    except httpx.HTTPError as exc:
        logger.warning("Expo push service error: %s", exc)
        raise HTTPException(status_code=502, detail="Failed to reach Expo push service")
    except Exception:
        logger.exception("Failed to send notification to user %s", request.to_user_id)
        raise HTTPException(status_code=500, detail="Failed to send notification")

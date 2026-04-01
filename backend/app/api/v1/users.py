from fastapi import APIRouter, Depends, HTTPException
from app.core.auth import get_current_user
from app.core.supabase import get_user_supabase
from app.schemas.users import UserProfile, UserUpdate, PushTokenRequest

router = APIRouter()


@router.get("/me", response_model=UserProfile)
async def get_user(user: dict = Depends(get_current_user)):
    supabase = get_user_supabase(user["token"])
    try:
        response = supabase.table("profiles").select("*").eq("id", user["id"]).execute()
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    if not response.data:
        raise HTTPException(status_code=404, detail="Profile not found")
    return response.data[0]


@router.patch("/me", response_model=UserProfile)
async def update_user(data: UserUpdate, user: dict = Depends(get_current_user)):
    update_data = data.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")
    supabase = get_user_supabase(user["token"])
    try:
        response = supabase.table("profiles").update(update_data).eq("id", user["id"]).execute()
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    if not response.data:
        raise HTTPException(status_code=404, detail="Profile not found")
    return response.data[0]


@router.put("/me/push-token")
async def register_push_token(
    payload: PushTokenRequest,
    user: dict = Depends(get_current_user),
):
    """Store Expo push token in user's profile."""
    import logging
    logger = logging.getLogger(__name__)
    supabase = get_user_supabase(user["token"])
    try:
        response = (
            supabase.table("profiles")
            .update({"push_token": payload.token})
            .eq("id", user["id"])
            .execute()
        )
    except Exception:
        logger.exception("Failed to register push token for user %s", user["id"])
        raise HTTPException(status_code=400, detail="Failed to register push token")
    if not response.data:
        raise HTTPException(status_code=404, detail="Profile not found")
    return {"registered": True}

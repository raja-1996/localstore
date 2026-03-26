from fastapi import APIRouter, Depends, HTTPException, status
from app.core.auth import get_current_user
from app.core.supabase import get_user_supabase
from app.schemas.profile import ProfileResponse, ProfileUpdateRequest

router = APIRouter()


@router.get("", response_model=ProfileResponse)
async def get_profile(user: dict = Depends(get_current_user)):
    supabase = get_user_supabase(user["token"])
    try:
        response = supabase.table("profiles").select("*").eq("id", user["id"]).execute()
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    if not response.data:
        raise HTTPException(status_code=404, detail="Profile not found")
    return response.data[0]


@router.patch("", response_model=ProfileResponse)
async def update_profile(data: ProfileUpdateRequest, user: dict = Depends(get_current_user)):
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

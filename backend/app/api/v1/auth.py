from fastapi import APIRouter, Depends, HTTPException, status
from app.core.auth import get_current_user
from app.core.supabase import _make_service_client
from app.schemas.auth import (
    SignUpRequest,
    LoginRequest,
    OTPRequest,
    OTPVerifyRequest,
    RefreshRequest,
    AuthResponse,
)

router = APIRouter()


def _build_auth_response(session) -> dict:
    return {
        "access_token": session.access_token,
        "refresh_token": session.refresh_token,
        "token_type": "bearer",
        "expires_in": session.expires_in,
        "user": {
            "id": str(session.user.id),
            "email": session.user.email,
            "phone": getattr(session.user, "phone", None),
        },
    }


@router.post("/signup", response_model=AuthResponse)
async def signup(data: SignUpRequest):
    try:
        supabase = _make_service_client()
        response = supabase.auth.sign_up({"email": data.email, "password": data.password})
        if not response.session:
            # Email confirmation may be required — return success message
            return {
                "access_token": "",
                "refresh_token": "",
                "token_type": "bearer",
                "expires_in": 0,
                "user": {"id": str(response.user.id) if response.user else "", "email": data.email, "phone": None},
            }
        return _build_auth_response(response.session)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/login", response_model=AuthResponse)
async def login(data: LoginRequest):
    try:
        supabase = _make_service_client()
        response = supabase.auth.sign_in_with_password({"email": data.email, "password": data.password})
        if not response.session:
            raise HTTPException(status_code=401, detail="Invalid credentials")
        return _build_auth_response(response.session)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=401, detail="Invalid credentials")


@router.post("/otp/send")
async def send_phone_otp(data: OTPRequest):
    try:
        supabase = _make_service_client()
        supabase.auth.sign_in_with_otp({"phone": data.phone})
        return {"message": "OTP sent"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/otp/verify", response_model=AuthResponse)
async def verify_phone_otp(data: OTPVerifyRequest):
    import logging
    logging.getLogger(__name__).error("OTP VERIFY: phone=%s token=%s", data.phone, data.token)
    try:
        supabase = _make_service_client()
        response = supabase.auth.verify_otp({"phone": data.phone, "token": data.token, "type": "sms"})
        if not response.session:
            raise HTTPException(status_code=401, detail="Invalid OTP")
        return _build_auth_response(response.session)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=401, detail="Invalid OTP")


@router.post("/refresh", response_model=AuthResponse)
async def refresh(data: RefreshRequest):
    try:
        supabase = _make_service_client()
        response = supabase.auth.refresh_session(data.refresh_token)
        if not response.session:
            raise HTTPException(status_code=401, detail="Invalid refresh token")
        return _build_auth_response(response.session)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=401, detail="Invalid refresh token")


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(user: dict = Depends(get_current_user)):
    try:
        from app.core.supabase import get_user_supabase
        user_client = get_user_supabase(user["token"])
        user_client.auth.sign_out()
    except Exception:
        pass


@router.delete("/account", status_code=status.HTTP_204_NO_CONTENT)
async def delete_account(user: dict = Depends(get_current_user)):
    try:
        supabase = _make_service_client()
        supabase.auth.admin.delete_user(user["id"])
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

import uuid
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from app.core.auth import get_current_user
from app.core.supabase import get_user_supabase
from app.schemas.storage import UploadResponse, DownloadResponse

router = APIRouter()

BUCKET_NAME = "uploads"


@router.post("/upload", response_model=UploadResponse)
async def upload_file(
    file: UploadFile = File(...),
    path: str = Form(None),
    user: dict = Depends(get_current_user),
):
    supabase = get_user_supabase(user["token"])

    # Generate path if not provided
    if not path:
        ext = file.filename.rsplit(".", 1)[-1] if file.filename and "." in file.filename else "bin"
        path = f"{user['id']}/{uuid.uuid4()}.{ext}"

    content = await file.read()
    try:
        supabase.storage.from_(BUCKET_NAME).upload(path, content, {"contentType": file.content_type or "application/octet-stream"})
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Get signed URL
    signed = supabase.storage.from_(BUCKET_NAME).create_signed_url(path, 3600)
    url = getattr(signed, "signed_url", "") or (signed.get("signedURL", "") if isinstance(signed, dict) else "")

    return {"path": path, "url": url}


@router.get("/download/{path:path}", response_model=DownloadResponse)
async def download_file(path: str, user: dict = Depends(get_current_user)):
    supabase = get_user_supabase(user["token"])
    try:
        signed = supabase.storage.from_(BUCKET_NAME).create_signed_url(path, 3600)
        url = getattr(signed, "signed_url", "") or (signed.get("signedURL", "") if isinstance(signed, dict) else "")
        return {"url": url}
    except Exception as e:
        raise HTTPException(status_code=404, detail="File not found")


@router.delete("/delete/{path:path}", status_code=204)
async def delete_file(path: str, user: dict = Depends(get_current_user)):
    supabase = get_user_supabase(user["token"])
    try:
        supabase.storage.from_(BUCKET_NAME).remove([path])
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

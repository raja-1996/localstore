from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, status
from app.core.auth import get_current_user
from app.core.supabase import get_user_supabase
from app.schemas.services import ServiceCreate, ServiceResponse, ServiceUpdate
from app.api.v1.deps import check_merchant_owner


def _serialize(d: dict) -> dict:
    """Convert Decimal to float so Supabase SDK can JSON-serialize the payload."""
    return {k: float(v) if isinstance(v, Decimal) else v for k, v in d.items()}

router = APIRouter()


@router.get("/merchants/{merchant_id}/services", response_model=list[ServiceResponse])
async def list_services(
    merchant_id: str, user: dict = Depends(get_current_user)
):
    supabase = get_user_supabase(user["token"])
    try:
        response = (
            supabase.table("services")
            .select("*")
            .eq("merchant_id", merchant_id)
            .execute()
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    if not response.data:
        # Distinguish "no services" from "merchant does not exist"
        try:
            merchant_check = (
                supabase.table("merchants")
                .select("id")
                .eq("id", merchant_id)
                .execute()
            )
        except Exception as e:
            raise HTTPException(status_code=400, detail=str(e))
        if not merchant_check.data:
            raise HTTPException(status_code=404, detail="Merchant not found")

    return response.data


@router.post(
    "/merchants/{merchant_id}/services",
    response_model=ServiceResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_service(
    merchant_id: str,
    data: ServiceCreate,
    user: dict = Depends(get_current_user),
):
    supabase = get_user_supabase(user["token"])
    check_merchant_owner(supabase, merchant_id, user["id"])

    payload = _serialize(data.model_dump())
    payload["merchant_id"] = merchant_id

    try:
        response = supabase.table("services").insert(payload).execute()
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    if not response.data:
        raise HTTPException(status_code=400, detail="Failed to create service")
    return response.data[0]


@router.patch(
    "/merchants/{merchant_id}/services/{service_id}",
    response_model=ServiceResponse,
)
async def update_service(
    merchant_id: str,
    service_id: str,
    data: ServiceUpdate,
    user: dict = Depends(get_current_user),
):
    supabase = get_user_supabase(user["token"])
    check_merchant_owner(supabase, merchant_id, user["id"])

    update_data = _serialize(data.model_dump(exclude_unset=True))
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    try:
        response = (
            supabase.table("services")
            .update(update_data)
            .eq("id", service_id)
            .eq("merchant_id", merchant_id)
            .execute()
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    if not response.data:
        raise HTTPException(status_code=404, detail="Service not found")
    return response.data[0]


@router.delete(
    "/merchants/{merchant_id}/services/{service_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_service(
    merchant_id: str,
    service_id: str,
    user: dict = Depends(get_current_user),
):
    supabase = get_user_supabase(user["token"])
    check_merchant_owner(supabase, merchant_id, user["id"])

    try:
        response = (
            supabase.table("services")
            .delete()
            .eq("id", service_id)
            .eq("merchant_id", merchant_id)
            .execute()
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    if not response.data:
        raise HTTPException(status_code=404, detail="Service not found")

from fastapi import HTTPException


def check_merchant_owner(supabase, merchant_id: str, user_id: str) -> None:
    """Raise 404/403 if merchant missing or caller is not the owner."""
    try:
        response = (
            supabase.table("merchants")
            .select("user_id")
            .eq("id", merchant_id)
            .execute()
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    if not response.data:
        raise HTTPException(status_code=404, detail="Merchant not found")
    if response.data[0]["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="Not allowed")

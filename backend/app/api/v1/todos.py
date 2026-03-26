from fastapi import APIRouter, Depends, HTTPException, status
from app.core.auth import get_current_user
from app.core.supabase import get_user_supabase
from app.schemas.todos import TodoCreate, TodoUpdate, TodoResponse

router = APIRouter()


@router.get("", response_model=list[TodoResponse])
async def list_todos(user: dict = Depends(get_current_user)):
    supabase = get_user_supabase(user["token"])
    response = supabase.table("todos").select("*").order("created_at", desc=True).execute()
    return response.data


@router.post("", response_model=TodoResponse, status_code=status.HTTP_201_CREATED)
async def create_todo(data: TodoCreate, user: dict = Depends(get_current_user)):
    supabase = get_user_supabase(user["token"])
    response = (
        supabase.table("todos")
        .insert({"user_id": user["id"], "title": data.title, "description": data.description})
        .execute()
    )
    return response.data[0]


@router.get("/{todo_id}", response_model=TodoResponse)
async def get_todo(todo_id: str, user: dict = Depends(get_current_user)):
    supabase = get_user_supabase(user["token"])
    response = supabase.table("todos").select("*").eq("id", todo_id).execute()
    if not response.data:
        raise HTTPException(status_code=404, detail="Todo not found")
    return response.data[0]


@router.patch("/{todo_id}", response_model=TodoResponse)
async def update_todo(todo_id: str, data: TodoUpdate, user: dict = Depends(get_current_user)):
    update_data = data.model_dump(exclude_none=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")
    supabase = get_user_supabase(user["token"])
    response = supabase.table("todos").update(update_data).eq("id", todo_id).execute()
    if not response.data:
        raise HTTPException(status_code=404, detail="Todo not found")
    return response.data[0]


@router.delete("/{todo_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_todo(todo_id: str, user: dict = Depends(get_current_user)):
    supabase = get_user_supabase(user["token"])
    response = supabase.table("todos").delete().eq("id", todo_id).execute()
    if not response.data:
        raise HTTPException(status_code=404, detail="Todo not found")

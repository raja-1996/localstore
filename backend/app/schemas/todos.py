from pydantic import BaseModel
from datetime import datetime


class TodoCreate(BaseModel):
    title: str
    description: str = ""


class TodoUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    is_completed: bool | None = None
    image_path: str | None = None


class TodoResponse(BaseModel):
    id: str
    user_id: str
    title: str
    description: str
    image_path: str | None
    is_completed: bool
    created_at: datetime
    updated_at: datetime

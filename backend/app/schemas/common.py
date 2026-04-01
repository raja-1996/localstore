from pydantic import BaseModel, Field
from typing import Generic, TypeVar

T = TypeVar("T")


class CursorParams(BaseModel):
    limit: int = Field(default=20, ge=1, le=100)
    before: str | None = None


class PaginatedResponse(BaseModel, Generic[T]):
    data: list[T]
    has_more: bool
    next_cursor: str | None = None

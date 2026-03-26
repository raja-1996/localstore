from fastapi import APIRouter
from app.api.v1 import auth, todos, storage, notifications, profile

v1_router = APIRouter()
v1_router.include_router(auth.router, prefix="/auth", tags=["auth"])
v1_router.include_router(todos.router, prefix="/todos", tags=["todos"])
v1_router.include_router(storage.router, prefix="/storage", tags=["storage"])
v1_router.include_router(notifications.router, prefix="/notifications", tags=["notifications"])
v1_router.include_router(profile.router, prefix="/profile", tags=["profile"])

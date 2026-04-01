from fastapi import APIRouter
from app.api.v1 import auth, storage, users, merchants, services, portfolio, feed, search, follows, reviews, posts, likes, comments, chat

v1_router = APIRouter()
v1_router.include_router(auth.router, prefix="/auth", tags=["auth"])
v1_router.include_router(storage.router, prefix="/storage", tags=["storage"])
v1_router.include_router(users.router, prefix="/users", tags=["users"])
# merchants: /me must be registered before /{merchant_id} (see merchants.py)
v1_router.include_router(merchants.router, prefix="/merchants", tags=["merchants"])
# services and portfolio: routes already contain full path /merchants/{mid}/...
v1_router.include_router(services.router, prefix="", tags=["services"])
v1_router.include_router(portfolio.router, prefix="", tags=["portfolio"])
# feed: /feed/nearby, /feed/following
v1_router.include_router(feed.router, prefix="/feed", tags=["feed"])
# search: /search?q=...
v1_router.include_router(search.router, prefix="/search", tags=["search"])
# follows: /merchants/{id}/follow, /merchants/{id}/followers, /users/me/following, /feed/following
v1_router.include_router(follows.router, prefix="", tags=["follows"])
# reviews: /merchants/{id}/reviews, /merchants/{id}/reviews/{review_id}
v1_router.include_router(reviews.router, prefix="", tags=["reviews"])
# posts: /merchants/{id}/posts, /merchants/{id}/posts/{post_id}
v1_router.include_router(posts.router, prefix="", tags=["posts"])
# likes: /posts/{id}/like
v1_router.include_router(likes.router, prefix="", tags=["likes"])
# comments: /posts/{id}/comments, /posts/{id}/comments/{comment_id}
v1_router.include_router(comments.router, prefix="", tags=["comments"])
# chat: /chats, /chats/{tid}/messages, /chats/{tid}/read
v1_router.include_router(chat.router, prefix="/chats", tags=["chat"])

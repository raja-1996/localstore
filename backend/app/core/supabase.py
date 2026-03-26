from functools import lru_cache
from supabase import create_client, Client, ClientOptions
from app.core.config import settings


@lru_cache()
def get_supabase() -> Client:
    """Service role client for admin operations (cached singleton)."""
    return create_client(settings.supabase_url, settings.supabase_secret_default_key)


def get_user_supabase(access_token: str) -> Client:
    """User-scoped client that inherits RLS context from JWT."""
    client = create_client(
        settings.supabase_url,
        settings.supabase_publishable_default_key,
        options=ClientOptions(
            headers={"Authorization": f"Bearer {access_token}"}
        ),
    )
    return client

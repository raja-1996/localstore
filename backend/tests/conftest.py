import os

# Must be set before any app imports so pydantic-settings can read them
os.environ.setdefault("SUPABASE_URL", "https://test.supabase.co")
os.environ.setdefault("SUPABASE_PUBLISHABLE_DEFAULT_KEY", "test-anon-key")
os.environ.setdefault("SUPABASE_SECRET_DEFAULT_KEY", "test-service-key")

import pytest
from unittest.mock import MagicMock
from fastapi.testclient import TestClient

from app.main import app
from app.core.auth import get_current_user

MOCK_USER = {"id": "user-123", "email": "test@example.com", "token": "test-token", "phone": None}
AUTH_HEADERS = {"Authorization": "Bearer test-token"}


def make_mock_session(
    access_token="access-abc",
    refresh_token="refresh-xyz",
    expires_in=3600,
    user_id="user-123",
    email="test@example.com",
    phone=None,
):
    session = MagicMock()
    session.access_token = access_token
    session.refresh_token = refresh_token
    session.expires_in = expires_in
    session.user.id = user_id
    session.user.email = email
    session.user.phone = phone
    return session


@pytest.fixture
def client():
    app.dependency_overrides[get_current_user] = lambda: MOCK_USER
    yield TestClient(app)
    app.dependency_overrides.clear()

"""
Integration test configuration.

Requires a running Supabase instance. Configure via environment variables or a
backend/.env.test file:

    SUPABASE_URL=http://localhost:54321
    SUPABASE_PUBLISHABLE_DEFAULT_KEY=<anon-key>
    SUPABASE_SECRET_DEFAULT_KEY=<service-role-key>

Local Supabase default keys (after `supabase start`):
    anon:         eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRFA0NiK7URikqthSMDbfQqCbHyFp6Hf1J_LTvJJVWY
    service_role: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hj04zWl196z2-SBc0

Run integration tests:
    pytest tests/integration/ -v

Skip integration tests (unit tests only):
    pytest tests/ --ignore=tests/integration/
"""
import os
import uuid
import socket
from urllib.parse import urlparse

import pytest
from dotenv import load_dotenv  # only needed if using .env.test; optional
from fastapi.testclient import TestClient

# Load .env.test if present (overrides existing env vars for integration tests)
_env_test = os.path.join(os.path.dirname(__file__), "..", "..", ".env.test")
if os.path.exists(_env_test):
    load_dotenv(_env_test, override=True)

# Integration tests require these env vars pointing to a real Supabase instance
_SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
_SUPABASE_ANON_KEY = os.environ.get("SUPABASE_PUBLISHABLE_DEFAULT_KEY", "")
_SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SECRET_DEFAULT_KEY", "")

# ── Reachability check ────────────────────────────────────────────────────────

def _is_supabase_reachable() -> bool:
    """Return True if the configured Supabase host:port is TCP-reachable."""
    if not _SUPABASE_URL:
        return False
    parsed = urlparse(_SUPABASE_URL)
    host = parsed.hostname or "localhost"
    port = parsed.port or (443 if parsed.scheme == "https" else 80)
    try:
        with socket.create_connection((host, port), timeout=2):
            return True
    except OSError:
        return False


_SUPABASE_AVAILABLE = _is_supabase_reachable()

skip_if_no_supabase = pytest.mark.skipif(
    not _SUPABASE_AVAILABLE,
    reason=(
        "Supabase not reachable at "
        f"{_SUPABASE_URL or 'SUPABASE_URL not set'}. "
        "Start local Supabase with `supabase start` or set env vars."
    ),
)

# ── Shared test-user fixture (session-scoped) ────────────────────────────────

TEST_PASSWORD = "IntegrationTest@123"


def _create_test_user(client: TestClient, email_prefix: str) -> dict:
    """
    Sign up and log in a test user. Returns a user info dict with keys:
    email, password, access_token, refresh_token, user_id, auth_headers.
    """
    email = f"{email_prefix}-{uuid.uuid4().hex[:8]}@gmail.com"

    # Sign up
    resp = client.post(
        "/api/v1/auth/signup",
        json={"email": email, "password": TEST_PASSWORD},
    )
    assert resp.status_code == 200, f"Signup failed: {resp.text}"

    # Sign in to obtain a confirmed session (email confirm is disabled)
    resp = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": TEST_PASSWORD},
    )
    assert resp.status_code == 200, f"Login failed: {resp.text}"
    data = resp.json()

    return {
        "email": email,
        "password": TEST_PASSWORD,
        "access_token": data["access_token"],
        "refresh_token": data["refresh_token"],
        "user_id": data["user"]["id"],
        "auth_headers": {"Authorization": f"Bearer {data['access_token']}"},
    }


@pytest.fixture(scope="session")
def integration_client():
    """
    FastAPI TestClient configured to hit a real Supabase instance.
    The env vars are already set (from .env.test or the shell), so we just
    import app after ensuring they are present.
    """
    assert _SUPABASE_AVAILABLE, "Supabase must be reachable to create the client"
    # Force the app to pick up the integration env vars
    os.environ["SUPABASE_URL"] = _SUPABASE_URL
    os.environ["SUPABASE_PUBLISHABLE_DEFAULT_KEY"] = _SUPABASE_ANON_KEY
    os.environ["SUPABASE_SECRET_DEFAULT_KEY"] = _SUPABASE_SERVICE_KEY

    # Reload config so Settings() re-reads the updated env vars
    import importlib
    import app.core.config as config_module
    importlib.reload(config_module)

    # Point supabase module to the fresh settings and clear cached client
    import app.core.supabase as supabase_module
    supabase_module.settings = config_module.settings
    supabase_module.get_supabase.cache_clear()

    from app.main import app
    # Remove unit-test dependency overrides if any leaked through
    app.dependency_overrides.clear()

    return TestClient(app)


@pytest.fixture(scope="session")
def test_user(integration_client):
    """
    Create a unique test user in Supabase for the whole test session.
    Yields a dict with `email`, `password`, `access_token`, `refresh_token`,
    `user_id`, and `auth_headers`.
    Deletes the user after the session ends.
    """
    user_info = _create_test_user(integration_client, "integration-test")

    yield user_info

    # Teardown: delete the test user via admin API
    from app.core.supabase import get_supabase
    try:
        get_supabase().auth.admin.delete_user(user_info["user_id"])
    except Exception as e:
        print(f"[integration] Warning: could not delete test user: {e}")


@pytest.fixture(scope="session")
def test_user_b(integration_client):
    """
    Create a second unique test user in Supabase for the whole test session.
    Used for cross-user RLS tests.
    Yields a dict with `email`, `password`, `access_token`, `refresh_token`,
    `user_id`, and `auth_headers`.
    Deletes the user after the session ends.
    """
    user_info = _create_test_user(integration_client, "integration-test-b")

    yield user_info

    # Teardown: delete the test user via admin API
    from app.core.supabase import get_supabase
    try:
        get_supabase().auth.admin.delete_user(user_info["user_id"])
    except Exception as e:
        print(f"[integration] Warning: could not delete test user B: {e}")

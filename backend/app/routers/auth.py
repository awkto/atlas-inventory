import secrets

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from app.auth import (
    SESSIONS,
    SESSION_TTL,
    create_session,
    get_api_token,
    get_password_hash,
    hash_password,
    is_first_run,
    load_auth_config,
    revoke_session,
    save_auth_config,
    verify_password,
)
from app.config import NOAUTH

router = APIRouter(tags=["auth"])


# ---------------------------------------------------------------------------
# Request schemas
# ---------------------------------------------------------------------------

class SetupRequest(BaseModel):
    password: str


class LoginRequest(BaseModel):
    password: str


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/api/auth/status")
def auth_status():
    """Return auth state so the frontend knows which screen to show."""
    return {
        "noauth": NOAUTH,
        "first_run": is_first_run(),
    }


@router.post("/api/setup")
def first_run_setup(body: SetupRequest):
    """Create admin password on first run. Generates an API token."""
    if NOAUTH:
        raise HTTPException(400, "Auth is disabled (NOAUTH mode)")
    if not is_first_run():
        raise HTTPException(400, "Setup already completed")

    password = body.password.strip()
    if len(password) < 8:
        raise HTTPException(400, "Password must be at least 8 characters")

    api_token = secrets.token_hex(32)
    config = load_auth_config()
    config["password_hash"] = hash_password(password)
    config["api_token"] = api_token
    save_auth_config(config)

    session_token = create_session()
    return {
        "success": True,
        "session_token": session_token,
        "api_token": api_token,
        "expires_in": SESSION_TTL,
    }


@router.post("/api/login")
def login(body: LoginRequest):
    if NOAUTH:
        raise HTTPException(400, "Auth is disabled (NOAUTH mode)")

    pw_hash = get_password_hash()
    if not pw_hash:
        raise HTTPException(403, "No password configured. Complete first-run setup.")

    if not verify_password(body.password, pw_hash):
        raise HTTPException(401, "Invalid password")

    session_token = create_session()
    return {"success": True, "session_token": session_token, "expires_in": SESSION_TTL}


@router.post("/api/logout")
def logout(request: Request):
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        revoke_session(auth[7:])
    return {"success": True}


@router.post("/api/auth/change-password")
def change_password(body: ChangePasswordRequest):
    if NOAUTH:
        raise HTTPException(400, "Auth is disabled (NOAUTH mode)")

    pw_hash = get_password_hash()
    if not pw_hash:
        raise HTTPException(400, "No password configured")

    if not verify_password(body.current_password, pw_hash):
        raise HTTPException(401, "Current password is incorrect")

    new_password = body.new_password.strip()
    if len(new_password) < 8:
        raise HTTPException(400, "New password must be at least 8 characters")

    config = load_auth_config()
    config["password_hash"] = hash_password(new_password)
    save_auth_config(config)

    # Invalidate all sessions, issue a fresh one
    SESSIONS.clear()
    session_token = create_session()
    return {"success": True, "session_token": session_token, "expires_in": SESSION_TTL}


@router.get("/api/auth/token")
def get_token():
    """Return the current API token (requires auth via middleware)."""
    if NOAUTH:
        return {"api_token": None, "noauth": True}
    return {"api_token": get_api_token()}


@router.post("/api/auth/token/regenerate")
def regenerate_token():
    """Generate a new API token. Existing API-token sessions stop working."""
    if NOAUTH:
        raise HTTPException(400, "Auth is disabled (NOAUTH mode)")

    new_token = secrets.token_hex(32)
    config = load_auth_config()
    config["api_token"] = new_token
    save_auth_config(config)
    return {"success": True, "api_token": new_token}

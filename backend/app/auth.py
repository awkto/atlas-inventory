import hashlib
import hmac
import json
import logging
import os
import secrets
import time

from app.config import NOAUTH

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Password hashing (PBKDF2-HMAC-SHA256)
# ---------------------------------------------------------------------------

def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    key = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 260_000)
    return f"pbkdf2:sha256:{salt}:{key.hex()}"


def verify_password(password: str, stored_hash: str) -> bool:
    try:
        parts = stored_hash.split(":", 3)
        if len(parts) != 4 or parts[0] != "pbkdf2" or parts[1] != "sha256":
            return False
        _, _, salt, key_hex = parts
        key = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 260_000)
        return hmac.compare_digest(key.hex(), key_hex)
    except Exception:
        return False


# ---------------------------------------------------------------------------
# In-memory session store
# ---------------------------------------------------------------------------

SESSIONS: dict[str, float] = {}  # token -> expiry timestamp
SESSION_TTL = 12 * 60 * 60  # 12 hours


def create_session() -> str:
    token = "sess_" + secrets.token_hex(32)
    SESSIONS[token] = time.time() + SESSION_TTL
    return token


def is_valid_session(token: str) -> bool:
    expiry = SESSIONS.get(token)
    if expiry is None:
        return False
    if time.time() > expiry:
        SESSIONS.pop(token, None)
        return False
    return True


def revoke_session(token: str) -> None:
    SESSIONS.pop(token, None)


# ---------------------------------------------------------------------------
# Auth config persistence (JSON file alongside the database)
# ---------------------------------------------------------------------------

_AUTH_CONFIG_PATH = os.path.join(
    os.path.dirname(os.getenv("DATABASE_URL", "sqlite:///./atlas.db").replace("sqlite:///", "")),
    "auth.json",
)
# For docker deployments where DB is at /data/atlas.db, config will be at /data/auth.json
# For local dev, it'll be alongside atlas.db
AUTH_CONFIG_PATH = os.getenv("AUTH_CONFIG_PATH", _AUTH_CONFIG_PATH) or "auth.json"


def load_auth_config() -> dict:
    try:
        with open(AUTH_CONFIG_PATH) as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return {}


def save_auth_config(config: dict) -> None:
    with open(AUTH_CONFIG_PATH, "w") as f:
        json.dump(config, f, indent=2)


def get_password_hash() -> str:
    return load_auth_config().get("password_hash", "")


def get_api_token() -> str:
    return load_auth_config().get("api_token", "")


def is_first_run() -> bool:
    if NOAUTH:
        return False
    return not bool(get_password_hash())


def validate_bearer(token: str) -> bool:
    """Check if a bearer token is a valid session or the API token."""
    if is_valid_session(token):
        return True
    api_token = get_api_token()
    if api_token and hmac.compare_digest(token, api_token):
        return True
    return False

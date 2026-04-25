import hashlib
import hmac
import json
import logging
import os
import secrets
import time
from datetime import date
from pathlib import Path

from app import settings
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
# Auth config — backed by the settings table (was /data/auth.json pre-v1.7.0)
# ---------------------------------------------------------------------------

# Legacy path; kept so we can migrate existing deployments and archive the file.
_LEGACY_AUTH_JSON_PATH = os.path.join(
    os.path.dirname(os.getenv("DATABASE_URL", "sqlite:///./atlas.db").replace("sqlite:///", "")),
    "auth.json",
)
AUTH_CONFIG_PATH = os.getenv("AUTH_CONFIG_PATH", _LEGACY_AUTH_JSON_PATH) or "auth.json"


def get_password_hash() -> str:
    return settings.get("auth.password_hash", "") or ""


def get_api_token() -> str:
    return settings.get("auth.api_token", "") or ""


def set_password_hash(h: str) -> None:
    settings.set("auth.password_hash", h)


def set_api_token(t: str) -> None:
    settings.set("auth.api_token", t, encrypted=True)


def load_auth_config() -> dict:
    """Compat shim for existing callers — returns the current auth values as a dict."""
    return {
        "password_hash": get_password_hash(),
        "api_token": get_api_token(),
    }


def save_auth_config(config: dict) -> None:
    """Compat shim — routes dict writes into the settings table."""
    if "password_hash" in config:
        set_password_hash(config["password_hash"])
    if "api_token" in config:
        set_api_token(config["api_token"])


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


# ---------------------------------------------------------------------------
# One-shot migration: /data/auth.json → settings table
# ---------------------------------------------------------------------------

def migrate_auth_json_to_settings() -> None:
    """Idempotent. Runs once at startup. Archives auth.json after migration."""
    path = Path(AUTH_CONFIG_PATH)
    if not path.exists():
        return

    # Already migrated? Just archive the stale file.
    if get_password_hash():
        _archive_legacy(path)
        return

    try:
        data = json.loads(path.read_text())
    except Exception as e:
        logger.error("auth.json migration: failed to read %s: %s", path, e)
        return

    migrated = []
    if data.get("password_hash"):
        set_password_hash(data["password_hash"])
        migrated.append("password_hash")
    if data.get("api_token"):
        set_api_token(data["api_token"])
        migrated.append("api_token")

    if migrated:
        logger.info("migrated auth.json → settings table: %s", ", ".join(migrated))
        _archive_legacy(path)
    else:
        logger.warning("auth.json present but had no recognisable fields; leaving file in place")


def _archive_legacy(path: Path) -> None:
    archived = path.with_name(f"{path.name}.migrated-{date.today().isoformat()}")
    try:
        path.rename(archived)
        logger.info("archived %s → %s", path, archived)
    except Exception as e:
        logger.warning("could not archive %s: %s", path, e)

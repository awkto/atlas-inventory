"""HA role state, Litestream supervisor, peer client.

Configuration precedence:
  settings table  >  env vars  >  hardcoded defaults

Everything except the local role + self_id lives in the settings table so it
rides along with Litestream replication. self_id and role stay in
/data/ha.json (they're identity, not config, and MUST differ between nodes).
"""
import atexit
import base64
import json
import logging
import os
import secrets as _secrets
import shutil
import signal
import subprocess
import threading
from datetime import datetime, timezone
from pathlib import Path

import httpx

from app import settings
from app.config import (
    DATABASE_URL,
    HA_ENABLED,
    HA_INITIAL_ROLE,
    HA_PEER_URL,
    HA_REPLICA_URL_PEER,
    HA_REPLICA_URL_SELF,
    HA_SELF_ID,
    HA_STATE_PATH,
    HA_TOKEN,
)

logger = logging.getLogger(__name__)

DB_PATH = DATABASE_URL.replace("sqlite:///", "")

_state_lock = threading.Lock()
_litestream_proc: subprocess.Popen | None = None


# ---------------------------------------------------------------------------
# Role + self_id state (local, /data/ha.json — NEVER replicated)
# ---------------------------------------------------------------------------

def _state_path() -> Path:
    return Path(HA_STATE_PATH)


def _default_state() -> dict:
    return {
        "role": HA_INITIAL_ROLE or "primary",
        "self_id": HA_SELF_ID or "A",
        "last_promoted_at": None,
        "last_demoted_at": None,
    }


def load_state() -> dict:
    with _state_lock:
        p = _state_path()
        if not p.exists():
            state = _default_state()
            _save_unlocked(state)
            return state
        try:
            return json.loads(p.read_text())
        except Exception as e:
            logger.warning("ha.json unreadable (%s); seeding default", e)
            state = _default_state()
            _save_unlocked(state)
            return state


def _save_unlocked(state: dict) -> None:
    p = _state_path()
    p.parent.mkdir(parents=True, exist_ok=True)
    tmp = p.with_suffix(".tmp")
    tmp.write_text(json.dumps(state, indent=2))
    tmp.replace(p)


def update_state(**kwargs) -> dict:
    with _state_lock:
        p = _state_path()
        state = json.loads(p.read_text()) if p.exists() else _default_state()
        state.update(kwargs)
        _save_unlocked(state)
        return state


def current_role() -> str:
    if not ha_enabled():
        return "primary"
    return load_state().get("role", "primary")


def self_id() -> str:
    return (load_state().get("self_id") or HA_SELF_ID or "A").upper()


def peer_id() -> str:
    return "B" if self_id() == "A" else "A"


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


# ---------------------------------------------------------------------------
# Effective config (settings > env)
# ---------------------------------------------------------------------------

def _bool_setting(key: str, fallback: bool) -> bool:
    v = settings.get(key)
    if v is None:
        return fallback
    return v.lower() in ("true", "1", "yes", "on")


def ha_enabled() -> bool:
    return _bool_setting("ha.enabled", HA_ENABLED)


def ha_token() -> str:
    return settings.get("ha.token") or HA_TOKEN or ""


def _slot(letter: str) -> str:
    return letter.lower()


def node_base_url(letter: str) -> str:
    key = f"ha.node_{_slot(letter)}.base_url"
    v = settings.get(key)
    if v:
        return v
    # Env fallback only makes sense for the "peer" slot; self base URL
    # is usually not configured locally.
    if letter.upper() == peer_id():
        return HA_PEER_URL or ""
    return ""


def node_replica_url(letter: str) -> str:
    key = f"ha.node_{_slot(letter)}.replica_url"
    v = settings.get(key)
    if v:
        return v
    if letter.upper() == self_id():
        return HA_REPLICA_URL_SELF or ""
    return HA_REPLICA_URL_PEER or ""


def self_replica_url() -> str:
    return node_replica_url(self_id())


def peer_replica_url() -> str:
    return node_replica_url(peer_id())


def peer_base_url() -> str:
    return node_base_url(peer_id())


# ---------------------------------------------------------------------------
# Litestream supervisor
# ---------------------------------------------------------------------------

def litestream_available() -> bool:
    return shutil.which("litestream") is not None


def litestream_pid() -> int | None:
    if _litestream_proc and _litestream_proc.poll() is None:
        return _litestream_proc.pid
    return None


def start_replicate() -> tuple[bool, str]:
    """Start `litestream replicate` pushing local DB → self replica URL."""
    global _litestream_proc
    stop_replicate()

    if not ha_enabled():
        return False, "HA disabled"
    url = self_replica_url()
    if not url:
        return False, "self replica URL not configured"
    if not litestream_available():
        return False, "litestream binary not installed"
    if not os.path.exists(DB_PATH):
        return False, f"db not found at {DB_PATH}"

    cmd = ["litestream", "replicate", DB_PATH, url]
    logger.info("starting litestream: %s", " ".join(["litestream", "replicate", DB_PATH, "<redacted>"]))
    try:
        _litestream_proc = subprocess.Popen(cmd)
    except Exception as e:
        return False, f"spawn failed: {e}"
    return True, f"pid {_litestream_proc.pid}"


def stop_replicate() -> None:
    global _litestream_proc
    if _litestream_proc is None:
        return
    proc = _litestream_proc
    _litestream_proc = None
    if proc.poll() is not None:
        return
    try:
        proc.send_signal(signal.SIGTERM)
        proc.wait(timeout=10)
    except Exception:
        try:
            proc.kill()
        except Exception:
            pass


def run_restore(replica_url: str) -> tuple[bool, str]:
    """Overwrite the local DB from `replica_url`. Caller must ensure no active writers."""
    if not replica_url:
        return False, "replica URL not set"
    if not litestream_available():
        return False, "litestream binary not installed"

    tmp = DB_PATH + ".restore"
    Path(tmp).unlink(missing_ok=True)
    cmd = ["litestream", "restore", "-o", tmp, replica_url]
    logger.info("restoring from replica: litestream restore -o %s <redacted>", tmp)
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=600)
    except Exception as e:
        return False, f"restore exec failed: {e}"
    if result.returncode != 0:
        Path(tmp).unlink(missing_ok=True)
        return False, f"restore failed: {result.stderr.strip() or result.stdout.strip()}"

    os.replace(tmp, DB_PATH)
    for suffix in ("-wal", "-shm"):
        Path(DB_PATH + suffix).unlink(missing_ok=True)
    # Restored DB may contain a different settings table — drop the cache so
    # the next reads come from the new rows.
    settings.invalidate()
    return True, "restored"


atexit.register(stop_replicate)


# ---------------------------------------------------------------------------
# Dynamic reconfigure — called when any ha.* setting changes
# ---------------------------------------------------------------------------

def reconfigure(changed_key: str = "") -> None:
    """React to HA setting changes. Restart litestream if primary; stop if not."""
    logger.info("ha.reconfigure triggered by %s", changed_key or "startup")
    if not ha_enabled():
        stop_replicate()
        return
    state = load_state()
    role = state.get("role", "primary")
    if role == "primary":
        ok, msg = start_replicate()
        logger.info("reconfigure → replicate: ok=%s msg=%s", ok, msg)
    else:
        stop_replicate()
        logger.info("reconfigure → standby, litestream idle")


# ---------------------------------------------------------------------------
# Peer client
# ---------------------------------------------------------------------------

def peer_status() -> dict | None:
    base = peer_base_url()
    if not base:
        return None
    try:
        r = httpx.get(f"{base.rstrip('/')}/api/ha/status", timeout=5.0, verify=False)
        if r.status_code == 200:
            return r.json()
    except Exception as e:
        logger.debug("peer_status unreachable: %s", e)
    return None


def demote_peer() -> tuple[bool, str]:
    base = peer_base_url()
    if not base:
        return False, "peer base URL not configured"
    token = ha_token()
    if not token:
        return False, "ha.token not configured"
    try:
        r = httpx.post(
            f"{base.rstrip('/')}/api/ha/demote",
            headers={"Authorization": f"Bearer {token}"},
            timeout=10.0,
            verify=False,
        )
        if r.status_code == 200:
            return True, "peer demoted"
        return False, f"peer returned {r.status_code}: {r.text[:200]}"
    except Exception as e:
        return False, f"peer unreachable: {e}"


# ---------------------------------------------------------------------------
# Pairing secret — encoded bundle exchanged between nodes during setup
# ---------------------------------------------------------------------------

def generate_pairing_secret(include_kek: bool = True) -> dict:
    """Create pairing bundle on the primary. Called via /api/ha/generate-pairing."""
    # Ensure a shared HA token exists
    token = ha_token()
    if not token:
        token = _secrets.token_urlsafe(32)
        settings.set("ha.token", token, encrypted=True)

    me = self_id()
    payload = {
        "v": 1,
        "primary_self_id": me,
        "primary_base_url": node_base_url(me),
        "primary_replica_url": node_replica_url(me),
        "ha_token": token,
    }
    if include_kek:
        # Include the KEK so the standby can decrypt replicated secrets after
        # Litestream ships the settings table. Pasted once, out-of-band.
        from app.settings import _resolve_kek  # internal — intentional
        payload["kek"] = base64.urlsafe_b64encode(_resolve_kek()).decode()

    encoded = base64.urlsafe_b64encode(json.dumps(payload).encode()).decode()
    return {"pairing_secret": encoded, "expires_hint": "valid as long as the primary's ha.token hasn't changed"}


def accept_pairing_secret(encoded: str, my_base_url: str, my_replica_url: str) -> dict:
    """Run on a fresh standby. Returns a structured result."""
    try:
        decoded = json.loads(base64.urlsafe_b64decode(encoded.encode()).decode())
    except Exception as e:
        return {"ok": False, "reason": f"invalid pairing secret: {e}"}

    if decoded.get("v") != 1:
        return {"ok": False, "reason": "pairing version mismatch"}

    primary_id = (decoded.get("primary_self_id") or "").upper()
    if primary_id not in ("A", "B"):
        return {"ok": False, "reason": "pairing missing valid primary_self_id"}

    my_id = "B" if primary_id == "A" else "A"

    # Install KEK if provided — required for encrypted settings from peer to decrypt
    kek_b64 = decoded.get("kek")
    if kek_b64:
        kek_bytes = base64.urlsafe_b64decode(kek_b64.encode())
        from app.config import SETTINGS_KEK_PATH
        Path(SETTINGS_KEK_PATH).parent.mkdir(parents=True, exist_ok=True)
        Path(SETTINGS_KEK_PATH).write_bytes(kek_bytes)
        try:
            os.chmod(SETTINGS_KEK_PATH, 0o600)
        except OSError:
            pass
        # Force Fernet to re-init on next use
        import app.settings as _s
        _s._fernet = None
        settings.invalidate()

    # Primary's config
    settings.set(f"ha.node_{_slot(primary_id)}.base_url", decoded.get("primary_base_url", ""))
    if decoded.get("primary_replica_url"):
        settings.set(
            f"ha.node_{_slot(primary_id)}.replica_url",
            decoded["primary_replica_url"],
            encrypted=True,
        )
    settings.set("ha.token", decoded["ha_token"], encrypted=True)

    # This node's own config
    settings.set(f"ha.node_{_slot(my_id)}.base_url", my_base_url)
    settings.set(f"ha.node_{_slot(my_id)}.replica_url", my_replica_url, encrypted=True)

    # Flip role + self_id locally
    update_state(self_id=my_id, role="standby")

    # Enable HA (won't spawn Litestream because role is standby)
    settings.set("ha.enabled", "true")

    # Ping peer to confirm
    peer = peer_status()
    return {
        "ok": True,
        "self_id": my_id,
        "peer_reachable": peer is not None,
        "peer_role": peer.get("role") if peer else None,
    }


# ---------------------------------------------------------------------------
# Startup
# ---------------------------------------------------------------------------

def on_startup() -> None:
    # React to future settings changes
    settings.on_change("ha.", reconfigure)

    if not ha_enabled():
        logger.info("HA disabled")
        return

    state = load_state()
    role = state.get("role", "primary")
    logger.info("HA enabled; self_id=%s role=%s", self_id(), role)
    reconfigure("startup")

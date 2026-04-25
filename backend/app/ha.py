"""HA role state and Litestream supervisor.

Wraps the Litestream binary (runs as a child process) so operators never
have to SSH in to pair nodes, promote a standby, or read replication
status. All of that is exposed via /api/ha/* endpoints.
"""
import atexit
import json
import logging
import os
import shutil
import signal
import subprocess
import threading
from datetime import datetime, timezone
from pathlib import Path

import httpx

from app.config import (
    DATABASE_URL,
    HA_ENABLED,
    HA_INITIAL_ROLE,
    HA_PEER_URL,
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
# Role state: /data/ha.json
# ---------------------------------------------------------------------------

def _state_path() -> Path:
    return Path(HA_STATE_PATH)


def _default_state() -> dict:
    return {
        "role": HA_INITIAL_ROLE or "primary",
        "self_id": HA_SELF_ID,
        "peer_url": HA_PEER_URL,
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
    if not HA_ENABLED:
        return "primary"
    return load_state().get("role", "primary")


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


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
    """Start `litestream replicate` pushing the local DB to HA_REPLICA_URL_SELF."""
    global _litestream_proc
    stop_replicate()

    if not HA_ENABLED:
        return False, "HA disabled"
    if not HA_REPLICA_URL_SELF:
        return False, "HA_REPLICA_URL_SELF not set"
    if not litestream_available():
        return False, "litestream binary not installed"
    if not os.path.exists(DB_PATH):
        return False, f"db not found at {DB_PATH}"

    cmd = ["litestream", "replicate", DB_PATH, HA_REPLICA_URL_SELF]
    logger.info("starting litestream: %s", " ".join(cmd))
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
    logger.info("restoring from replica: %s", " ".join(cmd))
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=600)
    except Exception as e:
        return False, f"restore exec failed: {e}"
    if result.returncode != 0:
        Path(tmp).unlink(missing_ok=True)
        return False, f"restore failed: {result.stderr.strip() or result.stdout.strip()}"

    # Atomic swap — relies on the caller having quiesced write traffic
    # (standby was returning 503s, so nothing was writing).
    os.replace(tmp, DB_PATH)
    # Clean up WAL/SHM from the stopped writer so SQLite re-opens cleanly.
    for suffix in ("-wal", "-shm"):
        Path(DB_PATH + suffix).unlink(missing_ok=True)
    return True, "restored"


atexit.register(stop_replicate)


# ---------------------------------------------------------------------------
# Peer client
# ---------------------------------------------------------------------------

def peer_status() -> dict | None:
    """GET /api/ha/status on the peer (open endpoint, no auth)."""
    if not HA_PEER_URL:
        return None
    try:
        r = httpx.get(
            f"{HA_PEER_URL.rstrip('/')}/api/ha/status",
            timeout=5.0,
            verify=False,
        )
        if r.status_code == 200:
            return r.json()
    except Exception as e:
        logger.debug("peer_status unreachable: %s", e)
    return None


def demote_peer() -> tuple[bool, str]:
    """Call POST /api/ha/demote on the peer, authenticated with HA_TOKEN."""
    if not HA_PEER_URL:
        return False, "HA_PEER_URL not set"
    if not HA_TOKEN:
        return False, "HA_TOKEN not set"
    try:
        r = httpx.post(
            f"{HA_PEER_URL.rstrip('/')}/api/ha/demote",
            headers={"Authorization": f"Bearer {HA_TOKEN}"},
            timeout=10.0,
            verify=False,
        )
        if r.status_code == 200:
            return True, "peer demoted"
        return False, f"peer returned {r.status_code}: {r.text[:200]}"
    except Exception as e:
        return False, f"peer unreachable: {e}"


# ---------------------------------------------------------------------------
# Startup
# ---------------------------------------------------------------------------

def on_startup() -> None:
    """Called from main.py after the DB is initialized."""
    if not HA_ENABLED:
        logger.info("HA disabled")
        return
    state = load_state()
    role = state.get("role", "primary")
    logger.info("HA enabled; self_id=%s role=%s", HA_SELF_ID, role)
    if role == "primary":
        ok, msg = start_replicate()
        logger.info("replicate: ok=%s msg=%s", ok, msg)
    else:
        logger.info("standby; litestream idle until promotion")

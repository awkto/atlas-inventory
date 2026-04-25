"""HA status + operator endpoints.

Routing layout:
- /api/ha/status        — open (peer polls this)
- /api/ha/demote        — HA_TOKEN auth (peer-triggered)
- /api/ha/failover      — session OR HA_TOKEN auth (operator-triggered)
- /api/ha/backup        — session auth (manual backup trigger)
- /api/ha/backups       — session auth (list)

All of these are in OPEN_PATHS at the middleware level; each endpoint
enforces its own auth. This lets the standby serve HA endpoints even when
it has no admin password configured locally (fresh standby scenario).
"""
import hmac
import logging
import sqlite3

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from app import backup, ha
from app.auth import validate_bearer
from app.config import (
    DATABASE_URL,
    HA_ENABLED,
    HA_PEER_URL,
    HA_REPLICA_URL_PEER,
    HA_SELF_ID,
    HA_TOKEN,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/ha", tags=["ha"])

DB_PATH = DATABASE_URL.replace("sqlite:///", "")


# ---------------------------------------------------------------------------
# Request schemas
# ---------------------------------------------------------------------------

class FailoverRequest(BaseModel):
    force: bool = False


# ---------------------------------------------------------------------------
# Auth helpers
# ---------------------------------------------------------------------------

def _bearer(request: Request) -> str | None:
    auth = request.headers.get("Authorization", "")
    return auth[7:] if auth.startswith("Bearer ") else None


def _require_ha_token(request: Request) -> None:
    if not HA_TOKEN:
        raise HTTPException(500, "HA_TOKEN not configured")
    token = _bearer(request)
    if not token or not hmac.compare_digest(token, HA_TOKEN):
        raise HTTPException(401, "invalid or missing HA token")


def _require_session_or_ha_token(request: Request) -> None:
    """Accept either a valid session/API-token (local operator) or HA_TOKEN."""
    token = _bearer(request)
    if not token:
        raise HTTPException(401, "missing bearer token")
    if validate_bearer(token):
        return
    if HA_TOKEN and hmac.compare_digest(token, HA_TOKEN):
        return
    raise HTTPException(401, "invalid token")


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/status")
def ha_status():
    """Open endpoint — returns role, peer health, replication + backup state."""
    if not HA_ENABLED:
        return {"enabled": False, "role": "primary"}

    state = ha.load_state()

    data_version = None
    try:
        with sqlite3.connect(DB_PATH) as con:
            data_version = con.execute("PRAGMA data_version").fetchone()[0]
    except Exception:
        pass

    peer = ha.peer_status()

    return {
        "enabled": True,
        "role": state.get("role"),
        "self_id": HA_SELF_ID,
        "peer_url": HA_PEER_URL,
        "peer_reachable": peer is not None,
        "peer_role": peer.get("role") if peer else None,
        "last_promoted_at": state.get("last_promoted_at"),
        "last_demoted_at": state.get("last_demoted_at"),
        "litestream_pid": ha.litestream_pid(),
        "litestream_available": ha.litestream_available(),
        "last_backup": backup.last_backup_info(),
        "data_version": data_version,
    }


@router.post("/failover")
def failover(body: FailoverRequest, request: Request):
    """Promote this node (standby → primary). Operator-triggered."""
    _require_session_or_ha_token(request)

    if not HA_ENABLED:
        raise HTTPException(400, "HA is not enabled")

    state = ha.load_state()
    if state.get("role") == "primary":
        raise HTTPException(400, "already primary")

    peer = ha.peer_status()
    if peer and peer.get("role") == "primary" and not body.force:
        raise HTTPException(
            status_code=409,
            detail={
                "error": "peer is still primary",
                "hint": "set force=true only if you are certain the peer is unreachable from clients",
                "peer": {"role": peer.get("role"), "url": HA_PEER_URL},
            },
        )

    # Pull the latest WAL from the peer's replica slot before flipping role.
    restored, restore_msg = ha.run_restore(HA_REPLICA_URL_PEER)
    if not restored:
        logger.warning("restore skipped/failed (continuing): %s", restore_msg)

    ha.update_state(role="primary", last_promoted_at=ha.now_iso())
    started, start_msg = ha.start_replicate()

    demoted, demote_msg = ha.demote_peer()

    return {
        "ok": True,
        "new_role": "primary",
        "restored": restored,
        "restore_msg": restore_msg,
        "replicate_started": started,
        "replicate_msg": start_msg,
        "peer_demoted": demoted,
        "demote_msg": demote_msg,
    }


@router.post("/demote")
def demote(request: Request):
    """Peer-triggered demotion (primary → standby). Authenticated by HA_TOKEN."""
    _require_ha_token(request)

    if not HA_ENABLED:
        raise HTTPException(400, "HA is not enabled")

    ha.stop_replicate()
    ha.update_state(role="standby", last_demoted_at=ha.now_iso())
    return {"ok": True, "new_role": "standby"}


@router.post("/backup")
def trigger_backup(request: Request, force: bool = False):
    """Run a backup now (respects skip-if-unchanged unless force=true)."""
    _require_session_or_ha_token(request)
    return backup.run_backup(force=force)


@router.get("/backups")
def list_backups(request: Request):
    _require_session_or_ha_token(request)
    return backup.list_backups()

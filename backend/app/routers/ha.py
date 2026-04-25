"""HA status + operator endpoints.

Routing layout:
- /api/ha/status            — open (peer polls this)
- /api/ha/demote            — HA_TOKEN auth (peer-triggered)
- /api/ha/failover          — session OR HA_TOKEN auth
- /api/ha/backup / /backups — session OR HA_TOKEN auth
- /api/ha/config GET/PUT    — session auth (operator)
- /api/ha/generate-pairing  — session auth (on primary)
- /api/ha/accept-pairing    — open when fresh (no password set yet), else session auth

All HA endpoints bypass the gateway's auth gate and self-authenticate here,
which lets a fresh standby accept pairing before first-run.
"""
import hmac
import logging
import sqlite3

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from app import backup, ha, settings
from app.auth import is_first_run, validate_bearer
from app.config import DATABASE_URL

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/ha", tags=["ha"])

DB_PATH = DATABASE_URL.replace("sqlite:///", "")


# ---------------------------------------------------------------------------
# Request schemas
# ---------------------------------------------------------------------------

class FailoverRequest(BaseModel):
    force: bool = False


class HAConfigUpdate(BaseModel):
    enabled: bool | None = None
    node_a_base_url: str | None = None
    node_a_replica_url: str | None = None
    node_b_base_url: str | None = None
    node_b_replica_url: str | None = None


class AcceptPairingRequest(BaseModel):
    pairing_secret: str
    my_base_url: str
    my_replica_url: str


# ---------------------------------------------------------------------------
# Auth helpers
# ---------------------------------------------------------------------------

def _bearer(request: Request) -> str | None:
    auth = request.headers.get("Authorization", "")
    return auth[7:] if auth.startswith("Bearer ") else None


def _require_ha_token(request: Request) -> None:
    token = ha.ha_token()
    if not token:
        raise HTTPException(500, "ha.token not configured")
    provided = _bearer(request)
    if not provided or not hmac.compare_digest(provided, token):
        raise HTTPException(401, "invalid or missing HA token")


def _require_session_or_ha_token(request: Request) -> None:
    provided = _bearer(request)
    if not provided:
        raise HTTPException(401, "missing bearer token")
    if validate_bearer(provided):
        return
    token = ha.ha_token()
    if token and hmac.compare_digest(provided, token):
        return
    raise HTTPException(401, "invalid token")


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/status")
def ha_status():
    """Open endpoint — returns role, peer health, replication + backup state."""
    if not ha.ha_enabled():
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
        "self_id": ha.self_id(),
        "peer_id": ha.peer_id(),
        "peer_url": ha.peer_base_url(),
        "peer_reachable": peer is not None,
        "peer_role": peer.get("role") if peer else None,
        "last_promoted_at": state.get("last_promoted_at"),
        "last_demoted_at": state.get("last_demoted_at"),
        "litestream_pid": ha.litestream_pid(),
        "litestream_available": ha.litestream_available(),
        "last_backup": backup.last_backup_info(),
        "data_version": data_version,
    }


@router.get("/config")
def get_config(request: Request):
    """Full HA config for the operator UI. Masks secrets."""
    _require_session_or_ha_token(request)
    return {
        "enabled": ha.ha_enabled(),
        "self_id": ha.self_id(),
        "peer_id": ha.peer_id(),
        "token_set": bool(ha.ha_token()),
        "node_a": {
            "base_url": ha.node_base_url("A"),
            "replica_url": ha.node_replica_url("A"),
        },
        "node_b": {
            "base_url": ha.node_base_url("B"),
            "replica_url": ha.node_replica_url("B"),
        },
    }


@router.put("/config")
def update_config(body: HAConfigUpdate, request: Request):
    _require_session_or_ha_token(request)
    changed = []
    if body.enabled is not None:
        settings.set("ha.enabled", "true" if body.enabled else "false")
        changed.append("enabled")
    if body.node_a_base_url is not None:
        settings.set("ha.node_a.base_url", body.node_a_base_url)
        changed.append("node_a.base_url")
    if body.node_a_replica_url is not None:
        settings.set("ha.node_a.replica_url", body.node_a_replica_url, encrypted=True)
        changed.append("node_a.replica_url")
    if body.node_b_base_url is not None:
        settings.set("ha.node_b.base_url", body.node_b_base_url)
        changed.append("node_b.base_url")
    if body.node_b_replica_url is not None:
        settings.set("ha.node_b.replica_url", body.node_b_replica_url, encrypted=True)
        changed.append("node_b.replica_url")
    return {"ok": True, "changed": changed}


@router.post("/generate-pairing")
def generate_pairing(request: Request):
    """Primary emits a pairing bundle (base64) — paste into the standby's UI."""
    _require_session_or_ha_token(request)
    if ha.load_state().get("role") != "primary":
        raise HTTPException(400, "only the primary can generate a pairing secret")
    return ha.generate_pairing_secret()


@router.post("/accept-pairing")
def accept_pairing(body: AcceptPairingRequest, request: Request):
    """Standby accepts a pairing secret.

    When this node has no local password set (fresh install), this endpoint is
    open — the operator hasn't had a chance to log in yet. Once a password is
    set, session/HA-token auth is required.
    """
    if not is_first_run():
        _require_session_or_ha_token(request)

    result = ha.accept_pairing_secret(
        body.pairing_secret,
        body.my_base_url,
        body.my_replica_url,
    )
    if not result.get("ok"):
        raise HTTPException(400, result.get("reason", "pairing failed"))
    return result


@router.post("/failover")
def failover(body: FailoverRequest, request: Request):
    _require_session_or_ha_token(request)

    if not ha.ha_enabled():
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
                "hint": "set force=true only if you are certain the peer is unreachable",
                "peer": {"role": peer.get("role"), "url": ha.peer_base_url()},
            },
        )

    restored, restore_msg = ha.run_restore(ha.peer_replica_url())
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
    _require_ha_token(request)

    if not ha.ha_enabled():
        raise HTTPException(400, "HA is not enabled")

    ha.stop_replicate()
    ha.update_state(role="standby", last_demoted_at=ha.now_iso())
    return {"ok": True, "new_role": "standby"}


@router.post("/backup")
def trigger_backup(request: Request, force: bool = False):
    _require_session_or_ha_token(request)
    return backup.run_backup(force=force)


@router.get("/backups")
def list_backups(request: Request):
    _require_session_or_ha_token(request)
    return backup.list_backups()

"""HA role state, Litestream supervisor, embedded SFTP, peer client.

Configuration precedence:
  settings table  >  env vars  >  defaults

Replica transport is SFTP, served by an `openssh-server` baked into the
container. Pairing exchanges SSH client pubkeys + sftp_host metadata so
the operator only enters peer base URL + their own SFTP advertise; replica
URLs are derived (`sftp://atlas@<peer>/<letter>`).
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
from urllib.parse import urlparse

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
DATA_DIR = os.path.dirname(DB_PATH) or "/data"

SSH_CLIENT_KEY_PATH = os.path.join(DATA_DIR, "atlas-ssh-key")
SSH_CLIENT_PUBKEY_PATH = SSH_CLIENT_KEY_PATH + ".pub"
AUTHORIZED_KEYS_PATH = os.path.join(DATA_DIR, "atlas-authorized_keys")
LITESTREAM_CONFIG_PATH = os.path.join(DATA_DIR, "litestream.yml")

_state_lock = threading.Lock()
_litestream_proc: subprocess.Popen | None = None
_sshd_proc: subprocess.Popen | None = None


# ---------------------------------------------------------------------------
# Local role state (NEVER replicated)
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
    v = settings.get(f"ha.node_{_slot(letter)}.base_url")
    if v:
        return v
    if letter.upper() == peer_id():
        return HA_PEER_URL or ""
    return ""


def node_sftp_host(letter: str) -> str:
    """Return host:port the peer should SFTP into for this node's replica."""
    v = settings.get(f"ha.node_{_slot(letter)}.sftp_host")
    if v:
        return v
    base = node_base_url(letter)
    if not base:
        return ""
    parsed = urlparse(base)
    host = parsed.hostname or ""
    return f"{host}:2222" if host else ""


def self_replica_url() -> str:
    """Where I push WAL → the PEER's SFTP inbox, into MY letter's directory.

    Each node's embedded SFTP receives the peer's writes into
    /data/replica-inbound/<peer-letter>/. So when I (letter X) push, I push
    to sftp://atlas@<peer-sftp-host>/<X>, and that lands inside the peer's
    /data/replica-inbound/X/.
    """
    peer_sftp = node_sftp_host(peer_id())
    if not peer_sftp:
        legacy = settings.get(f"ha.node_{_slot(self_id())}.replica_url")
        if legacy:
            return legacy
        return HA_REPLICA_URL_SELF or ""
    return f"sftp://atlas@{peer_sftp}/{self_id()}"


def peer_replica_url() -> str:
    """Where I restore from on promotion → my LOCAL inbox, where the (now-old)
    primary was SFTP'ing into me. No remote read needed at promotion time."""
    legacy = settings.get(f"ha.node_{_slot(peer_id())}.replica_url")
    if legacy:
        return legacy
    return f"file:///srv/replica-inbound/{peer_id()}"


def node_replica_url(letter: str) -> str:
    """For UI display only — show what each node's logical replica destination
    looks like from its own perspective."""
    if letter.upper() == self_id():
        return self_replica_url()
    if letter.upper() == peer_id():
        return f"sftp://atlas@{node_sftp_host(self_id())}/{peer_id()}"
    return ""


def peer_base_url() -> str:
    return node_base_url(peer_id())


# ---------------------------------------------------------------------------
# SSH client identity (this node's identity for SFTP'ing to peers)
# ---------------------------------------------------------------------------

def ensure_ssh_client_key() -> str:
    """Create an ed25519 keypair on first call. Returns the public key."""
    if os.path.exists(SSH_CLIENT_KEY_PATH) and os.path.exists(SSH_CLIENT_PUBKEY_PATH):
        return Path(SSH_CLIENT_PUBKEY_PATH).read_text().strip()
    Path(DATA_DIR).mkdir(parents=True, exist_ok=True)
    Path(SSH_CLIENT_KEY_PATH).unlink(missing_ok=True)
    Path(SSH_CLIENT_PUBKEY_PATH).unlink(missing_ok=True)
    cmd = [
        "ssh-keygen", "-t", "ed25519",
        "-f", SSH_CLIENT_KEY_PATH,
        "-N", "",
        "-C", f"atlas-{self_id()}@{datetime.now(timezone.utc).date().isoformat()}",
        "-q",
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"ssh-keygen failed: {result.stderr}")
    os.chmod(SSH_CLIENT_KEY_PATH, 0o600)
    return Path(SSH_CLIENT_PUBKEY_PATH).read_text().strip()


def ssh_client_pubkey() -> str:
    if not os.path.exists(SSH_CLIENT_PUBKEY_PATH):
        return ensure_ssh_client_key()
    return Path(SSH_CLIENT_PUBKEY_PATH).read_text().strip()


def install_peer_pubkey(pubkey: str) -> bool:
    """Append a peer's SSH client pubkey to authorized_keys (idempotent)."""
    if not pubkey or not pubkey.strip():
        return False
    pubkey = pubkey.strip()
    Path(AUTHORIZED_KEYS_PATH).touch(exist_ok=True)
    existing = Path(AUTHORIZED_KEYS_PATH).read_text() if os.path.exists(AUTHORIZED_KEYS_PATH) else ""
    # Match on the key body (ignore comment) so the same key under a different
    # comment is still detected as a duplicate.
    key_body = " ".join(pubkey.split()[:2])
    for line in existing.splitlines():
        if line.startswith("#") or not line.strip():
            continue
        if " ".join(line.split()[:2]) == key_body:
            return False
    with open(AUTHORIZED_KEYS_PATH, "a") as f:
        if existing and not existing.endswith("\n"):
            f.write("\n")
        f.write(pubkey + "\n")
    try:
        os.chmod(AUTHORIZED_KEYS_PATH, 0o600)
    except OSError:
        pass
    return True


# ---------------------------------------------------------------------------
# sshd supervisor (embedded SFTP server)
# ---------------------------------------------------------------------------

def sshd_available() -> bool:
    return shutil.which("sshd") is not None or os.path.exists("/usr/sbin/sshd")


def sshd_pid() -> int | None:
    if _sshd_proc and _sshd_proc.poll() is None:
        return _sshd_proc.pid
    return None


def start_sshd() -> tuple[bool, str]:
    global _sshd_proc
    stop_sshd()

    if not sshd_available():
        return False, "sshd binary not installed"
    cfg = "/etc/ssh/sshd_atlas.conf"
    if not os.path.exists(cfg):
        return False, f"sshd config not found at {cfg}"

    cmd = ["/usr/sbin/sshd", "-D", "-e", "-f", cfg]
    logger.info("starting sshd (atlas SFTP) -f %s", cfg)
    try:
        _sshd_proc = subprocess.Popen(cmd)
    except Exception as e:
        return False, f"sshd spawn failed: {e}"
    return True, f"pid {_sshd_proc.pid}"


def stop_sshd() -> None:
    global _sshd_proc
    if _sshd_proc is None:
        return
    proc = _sshd_proc
    _sshd_proc = None
    if proc.poll() is not None:
        return
    try:
        proc.send_signal(signal.SIGTERM)
        proc.wait(timeout=5)
    except Exception:
        try:
            proc.kill()
        except Exception:
            pass


# ---------------------------------------------------------------------------
# Litestream supervisor — uses YAML config for SFTP key-path
# ---------------------------------------------------------------------------

def litestream_available() -> bool:
    return shutil.which("litestream") is not None


def litestream_pid() -> int | None:
    if _litestream_proc and _litestream_proc.poll() is None:
        return _litestream_proc.pid
    return None


def _build_litestream_config() -> str | None:
    """Render YAML config for the current peer set. Returns None if HA not ready."""
    url = self_replica_url()
    if not url:
        return None

    # Parse SFTP URL: sftp://USER@HOST:PORT/PATH
    if url.startswith("sftp://"):
        rest = url[7:]
        userhost, _, path = rest.partition("/")
        user, _, hostport = userhost.partition("@")
        host, _, port_s = hostport.partition(":")
        port = int(port_s) if port_s else 22
        replica_block = (
            "      - type: sftp\n"
            f"        host: {host}\n"
            f"        port: {port}\n"
            f"        user: {user or 'atlas'}\n"
            f"        key-path: {SSH_CLIENT_KEY_PATH}\n"
            f"        path: /{path}\n"
        )
    elif url.startswith(("s3://", "gs://", "abs://", "file://")):
        replica_block = f"      - url: {url}\n"
    else:
        return None

    return (
        "dbs:\n"
        f"  - path: {DB_PATH}\n"
        "    replicas:\n"
        f"{replica_block}"
    )


def start_replicate() -> tuple[bool, str]:
    global _litestream_proc
    stop_replicate()

    if not ha_enabled():
        return False, "HA disabled"
    if not litestream_available():
        return False, "litestream binary not installed"
    if not os.path.exists(DB_PATH):
        return False, f"db not found at {DB_PATH}"

    cfg = _build_litestream_config()
    if not cfg:
        return False, "self replica URL not configured"

    Path(LITESTREAM_CONFIG_PATH).write_text(cfg)
    cmd = ["litestream", "replicate", "-config", LITESTREAM_CONFIG_PATH]
    logger.info("starting litestream replicate -config %s", LITESTREAM_CONFIG_PATH)
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
    if not replica_url:
        return False, "replica URL not set"
    if not litestream_available():
        return False, "litestream binary not installed"

    tmp = DB_PATH + ".restore"
    Path(tmp).unlink(missing_ok=True)

    if replica_url.startswith("sftp://"):
        # Build a YAML config restore-source — easier than the URL form for SFTP.
        rest = replica_url[7:]
        userhost, _, path = rest.partition("/")
        user, _, hostport = userhost.partition("@")
        host, _, port_s = hostport.partition(":")
        port = int(port_s) if port_s else 22
        cfg = (
            "dbs:\n"
            f"  - path: {DB_PATH}\n"
            "    replicas:\n"
            "      - type: sftp\n"
            f"        host: {host}\n"
            f"        port: {port}\n"
            f"        user: {user or 'atlas'}\n"
            f"        key-path: {SSH_CLIENT_KEY_PATH}\n"
            f"        path: /{path}\n"
        )
        cfg_path = LITESTREAM_CONFIG_PATH + ".restore"
        Path(cfg_path).write_text(cfg)
        cmd = ["litestream", "restore", "-config", cfg_path, "-o", tmp, DB_PATH]
    else:
        cmd = ["litestream", "restore", "-o", tmp, replica_url]

    logger.info("restoring from replica (peer)")
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
    settings.invalidate()
    return True, "restored"


atexit.register(stop_replicate)
atexit.register(stop_sshd)


# ---------------------------------------------------------------------------
# Dynamic reconfigure
# ---------------------------------------------------------------------------

def reconfigure(changed_key: str = "") -> None:
    logger.info("ha.reconfigure (%s)", changed_key or "startup")

    # Start sshd unconditionally if the binary is available — pairing needs
    # the SFTP endpoint reachable BEFORE HA gets toggled on. The cost of an
    # idle sshd is trivial; the cost of a chicken-and-egg pairing failure is
    # not.
    if sshd_available() and sshd_pid() is None:
        ok, msg = start_sshd()
        logger.info("sshd: ok=%s msg=%s", ok, msg)

    if not ha_enabled():
        stop_replicate()
        return

    role = load_state().get("role", "primary")
    if role == "primary":
        ok, msg = start_replicate()
        logger.info("reconfigure → replicate: ok=%s msg=%s", ok, msg)
    else:
        stop_replicate()


# ---------------------------------------------------------------------------
# Peer HTTP client
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


def call_peer_register(my_id: str, my_base_url: str, my_sftp_host: str, my_pubkey: str) -> tuple[bool, str]:
    base = peer_base_url()
    if not base:
        return False, "peer base URL not configured"
    token = ha_token()
    if not token:
        return False, "ha.token not configured"
    try:
        r = httpx.post(
            f"{base.rstrip('/')}/api/ha/register-peer",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "id": my_id,
                "base_url": my_base_url,
                "sftp_host": my_sftp_host,
                "ssh_pubkey": my_pubkey,
            },
            timeout=10.0,
            verify=False,
        )
        if r.status_code == 200:
            return True, "peer registered us"
        return False, f"peer returned {r.status_code}: {r.text[:300]}"
    except Exception as e:
        return False, f"peer unreachable: {e}"


# ---------------------------------------------------------------------------
# Pairing — exchange config + SSH client pubkeys
# ---------------------------------------------------------------------------

def generate_pairing_secret(my_base_url: str = "", my_sftp_host: str = "") -> dict:
    """Build a pairing bundle on the primary."""
    # Generating a pairing means we ARE a cluster of (currently) one.
    # Flip ha.enabled now so Litestream is ready to start the moment the
    # peer registers — operator doesn't have to toggle it separately.
    settings.set("ha.enabled", "true")

    token = ha_token()
    if not token:
        token = _secrets.token_urlsafe(32)
        settings.set("ha.token", token, encrypted=True)

    me = self_id()
    pubkey = ensure_ssh_client_key()

    # Use provided values or settings; never invent a wrong default here.
    base_url = my_base_url or node_base_url(me)
    sftp_host = my_sftp_host or node_sftp_host(me)

    # Persist self info so subsequent pairings are consistent
    if base_url:
        settings.set(f"ha.node_{_slot(me)}.base_url", base_url)
    if sftp_host:
        settings.set(f"ha.node_{_slot(me)}.sftp_host", sftp_host)

    payload = {
        "v": 2,
        "primary_self_id": me,
        "primary_base_url": base_url,
        "primary_sftp_host": sftp_host,
        "primary_ssh_pubkey": pubkey,
        "ha_token": token,
    }
    # Include the KEK so encrypted settings replicated via the DB stay
    # decryptable on the standby.
    from app.settings import _resolve_kek
    payload["kek"] = base64.urlsafe_b64encode(_resolve_kek()).decode()

    encoded = base64.urlsafe_b64encode(json.dumps(payload).encode()).decode()
    return {"pairing_secret": encoded}


def accept_pairing_secret(encoded: str, my_base_url: str, my_sftp_host: str) -> dict:
    """Run on a fresh standby."""
    try:
        decoded = json.loads(base64.urlsafe_b64decode(encoded.encode()).decode())
    except Exception as e:
        return {"ok": False, "reason": f"invalid pairing secret: {e}"}

    if decoded.get("v") != 2:
        return {"ok": False, "reason": "pairing version mismatch (need v2)"}

    primary_id = (decoded.get("primary_self_id") or "").upper()
    if primary_id not in ("A", "B"):
        return {"ok": False, "reason": "missing primary_self_id"}

    my_id = "B" if primary_id == "A" else "A"

    # Re-encrypt currently-encrypted rows with the incoming KEK so existing
    # settings (e.g. local API token from first-run) stay decryptable.
    kek_b64 = decoded.get("kek")
    if kek_b64:
        new_kek = base64.urlsafe_b64decode(kek_b64.encode())
        _swap_kek(new_kek)

    primary_pubkey = decoded.get("primary_ssh_pubkey", "")
    if primary_pubkey:
        install_peer_pubkey(primary_pubkey)

    # Generate own SSH client identity
    my_pubkey = ensure_ssh_client_key()

    # Persist primary's coords + token
    settings.set(f"ha.node_{_slot(primary_id)}.base_url", decoded.get("primary_base_url", ""))
    settings.set(f"ha.node_{_slot(primary_id)}.sftp_host", decoded.get("primary_sftp_host", ""))
    settings.set(f"ha.node_{_slot(primary_id)}.ssh_pubkey", primary_pubkey)
    settings.set("ha.token", decoded["ha_token"], encrypted=True)

    # Persist this node's coords
    settings.set(f"ha.node_{_slot(my_id)}.base_url", my_base_url)
    settings.set(f"ha.node_{_slot(my_id)}.sftp_host", my_sftp_host)
    settings.set(f"ha.node_{_slot(my_id)}.ssh_pubkey", my_pubkey)

    # Local role state
    update_state(self_id=my_id, role="standby")

    # Enable HA — won't spawn Litestream because role=standby, but will start sshd
    settings.set("ha.enabled", "true")

    # Tell the primary about us so it can install our pubkey + know how to
    # SFTP into our replica slot.
    registered, register_msg = call_peer_register(
        my_id, my_base_url, my_sftp_host, my_pubkey
    )

    peer = peer_status()
    return {
        "ok": True,
        "self_id": my_id,
        "registered_with_peer": registered,
        "register_msg": register_msg,
        "peer_reachable": peer is not None,
        "peer_role": peer.get("role") if peer else None,
    }


def register_incoming_peer(peer_id_letter: str, base_url: str, sftp_host: str, ssh_pubkey: str) -> dict:
    """Called by the standby on the primary as the second leg of pairing."""
    pid = peer_id_letter.upper()
    if pid not in ("A", "B"):
        return {"ok": False, "reason": "invalid peer id"}
    if pid == self_id():
        return {"ok": False, "reason": "peer claims our self_id"}

    if ssh_pubkey:
        install_peer_pubkey(ssh_pubkey)
    settings.set(f"ha.node_{_slot(pid)}.base_url", base_url)
    settings.set(f"ha.node_{_slot(pid)}.sftp_host", sftp_host)
    settings.set(f"ha.node_{_slot(pid)}.ssh_pubkey", ssh_pubkey)
    # Belt-and-suspenders: by now the cluster is definitely paired.
    settings.set("ha.enabled", "true")
    return {"ok": True}


def _swap_kek(new_kek: bytes) -> None:
    """Re-encrypt all existing encrypted rows with the new KEK, then install it."""
    from app.config import SETTINGS_KEK_PATH
    from cryptography.fernet import Fernet, InvalidToken
    from sqlalchemy import text
    from app.database import SessionLocal
    import app.settings as _s

    old_fernet = _s._get_fernet()
    new_fernet = Fernet(new_kek)

    db = SessionLocal()
    try:
        rows = db.execute(text("SELECT key, value FROM settings WHERE encrypted=1")).fetchall()
        re_encrypted = []
        for key, encrypted_value in rows:
            try:
                plain = old_fernet.decrypt(encrypted_value.encode()).decode()
            except InvalidToken:
                logger.warning("could not decrypt %s during KEK swap; leaving stale", key)
                continue
            re_encrypted.append((key, new_fernet.encrypt(plain.encode()).decode()))
        for key, new_value in re_encrypted:
            db.execute(
                text("UPDATE settings SET value=:v, updated_at=CURRENT_TIMESTAMP WHERE key=:k"),
                {"k": key, "v": new_value},
            )
        db.commit()
    finally:
        db.close()

    # Install new KEK on disk
    Path(SETTINGS_KEK_PATH).parent.mkdir(parents=True, exist_ok=True)
    Path(SETTINGS_KEK_PATH).write_bytes(new_kek)
    try:
        os.chmod(SETTINGS_KEK_PATH, 0o600)
    except OSError:
        pass

    # Force settings module to re-init Fernet on next use
    _s._fernet = None
    settings.invalidate()


# ---------------------------------------------------------------------------
# Startup
# ---------------------------------------------------------------------------

def on_startup() -> None:
    settings.on_change("ha.", reconfigure)

    # Generate the SSH identity eagerly so the pubkey is available the moment
    # an operator clicks "Generate pairing" — no first-call latency.
    try:
        ensure_ssh_client_key()
    except Exception as e:
        logger.warning("could not generate SSH client key: %s", e)

    # Always start sshd if available (see reconfigure() for the why).
    state = load_state()
    role = state.get("role", "primary")
    logger.info("HA self_id=%s role=%s enabled=%s", self_id(), role, ha_enabled())
    reconfigure("startup")

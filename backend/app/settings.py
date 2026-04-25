"""Persistent key/value settings stored in the SQL DB.

Lives in the same SQLite file as inventory data, so rides along with
Litestream replication. Secret values are Fernet-wrapped with a KEK
held outside the DB (env var or /data/settings-kek). This is the backbone
for auth-in-DB (v1.7.0) and HA-config-in-DB (v1.8.0).
"""
from __future__ import annotations

import base64
import hashlib
import logging
import os
import threading
from pathlib import Path
from typing import Callable

from cryptography.fernet import Fernet, InvalidToken
from sqlalchemy import text

from app.config import SETTINGS_KEK, SETTINGS_KEK_PATH
from app.database import SessionLocal

logger = logging.getLogger(__name__)

_cache: dict[str, str | None] = {}
_cache_lock = threading.Lock()
_fernet: Fernet | None = None
_listeners: list[tuple[str, Callable[[str], None]]] = []


# ---------------------------------------------------------------------------
# KEK resolution — env var > file > generate + persist
# ---------------------------------------------------------------------------

def _resolve_kek() -> bytes:
    if SETTINGS_KEK:
        # Accept either a raw Fernet key (base64url, 44 chars ending in '=')
        # or any string — derive via sha256 so operators can pick anything.
        if len(SETTINGS_KEK) == 44 and SETTINGS_KEK.endswith("="):
            return SETTINGS_KEK.encode()
        digest = hashlib.sha256(SETTINGS_KEK.encode()).digest()
        return base64.urlsafe_b64encode(digest)

    p = Path(SETTINGS_KEK_PATH)
    if p.exists():
        return p.read_bytes().strip()

    new_kek = Fernet.generate_key()
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_bytes(new_kek)
    try:
        os.chmod(p, 0o600)
    except OSError:
        pass
    logger.warning(
        "SETTINGS_KEK env var not set; generated a new key and persisted it to %s. "
        "For HA deployments, set SETTINGS_KEK env var to the same value on both "
        "hosts (or copy the KEK file). Without it, encrypted settings rows on the "
        "peer will be unreadable after failover.",
        p,
    )
    return new_kek


def _get_fernet() -> Fernet:
    global _fernet
    if _fernet is None:
        _fernet = Fernet(_resolve_kek())
    return _fernet


# ---------------------------------------------------------------------------
# Table
# ---------------------------------------------------------------------------

def ensure_table() -> None:
    db = SessionLocal()
    try:
        db.execute(text("""
            CREATE TABLE IF NOT EXISTS settings (
                key        TEXT PRIMARY KEY,
                value      TEXT NOT NULL,
                encrypted  INTEGER NOT NULL DEFAULT 0,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """))
        db.commit()
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def get(key: str, default: str | None = None) -> str | None:
    with _cache_lock:
        if key in _cache:
            return _cache[key] if _cache[key] is not None else default

    db = SessionLocal()
    try:
        row = db.execute(
            text("SELECT value, encrypted FROM settings WHERE key=:k"),
            {"k": key},
        ).fetchone()
    finally:
        db.close()

    if row is None:
        with _cache_lock:
            _cache[key] = None
        return default

    value, enc = row
    if enc:
        try:
            value = _get_fernet().decrypt(value.encode()).decode()
        except InvalidToken:
            logger.error(
                "failed to decrypt settings[%s] — KEK mismatch? returning default",
                key,
            )
            return default

    with _cache_lock:
        _cache[key] = value
    return value


def set(key: str, value: str, encrypted: bool = False) -> None:  # noqa: A001
    stored = _get_fernet().encrypt(value.encode()).decode() if encrypted else value

    db = SessionLocal()
    try:
        db.execute(
            text("""
                INSERT INTO settings (key, value, encrypted, updated_at)
                VALUES (:k, :v, :e, CURRENT_TIMESTAMP)
                ON CONFLICT(key) DO UPDATE SET
                    value=excluded.value,
                    encrypted=excluded.encrypted,
                    updated_at=CURRENT_TIMESTAMP
            """),
            {"k": key, "v": stored, "e": 1 if encrypted else 0},
        )
        db.commit()
    finally:
        db.close()

    with _cache_lock:
        _cache[key] = value

    _fire_listeners(key)


def delete(key: str) -> None:
    db = SessionLocal()
    try:
        db.execute(text("DELETE FROM settings WHERE key=:k"), {"k": key})
        db.commit()
    finally:
        db.close()

    with _cache_lock:
        _cache.pop(key, None)

    _fire_listeners(key)


def dump_public() -> dict[str, str]:
    """Return all non-encrypted keys — safe to expose to the UI."""
    db = SessionLocal()
    try:
        rows = db.execute(
            text("SELECT key, value FROM settings WHERE encrypted=0")
        ).fetchall()
    finally:
        db.close()
    return {r[0]: r[1] for r in rows}


def invalidate() -> None:
    """Drop the in-memory cache. Call after replication restore."""
    with _cache_lock:
        _cache.clear()


def on_change(prefix: str, callback: Callable[[str], None]) -> None:
    """Register a callback that fires when any `prefix*` key is set or deleted."""
    _listeners.append((prefix, callback))


def _fire_listeners(key: str) -> None:
    for prefix, cb in _listeners:
        if key.startswith(prefix):
            try:
                cb(key)
            except Exception:
                logger.exception("settings listener for prefix %r failed", prefix)

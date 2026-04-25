from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text

from app.auth import is_first_run, migrate_auth_json_to_settings, validate_bearer
from app.config import HA_ENABLED, HA_PEER_URL, NOAUTH
from app.database import Base, engine, SessionLocal
from app import backup, ha, settings
from app.routers import auth, export, items, mcp, networks, search
from app.routers import ha as ha_router

Base.metadata.create_all(bind=engine)
settings.ensure_table()
migrate_auth_json_to_settings()


def run_column_migrations():
    """Add new columns to existing tables. Idempotent."""
    db = SessionLocal()
    try:
        for col_sql in [
            "ALTER TABLE items ADD COLUMN vmid INTEGER",
            "ALTER TABLE items ADD COLUMN ports TEXT",
        ]:
            try:
                db.execute(text(col_sql))
                db.commit()
            except Exception:
                db.rollback()
    finally:
        db.close()


run_column_migrations()


def run_migration():
    """Migrate devices/endpoints/repositories data into items table. Idempotent."""
    db = SessionLocal()
    try:
        # Skip if items table already has data
        item_count = db.execute(text("SELECT COUNT(*) FROM items")).scalar()
        if item_count > 0:
            return

        # Check if devices table exists and has data
        try:
            device_count = db.execute(text("SELECT COUNT(*) FROM devices")).scalar()
        except Exception:
            return
        if device_count == 0:
            return

        # --- Migrate devices → items (first pass: insert without parent_id) ---
        devices = db.execute(text(
            "SELECT id, name, fqdn, ips, type, platform, status, notes, openbao_paths, tags, "
            "parent_id, network_id, created_at, updated_at FROM devices"
        )).fetchall()

        # Remap device types
        type_map = {
            "network-device": "device",
            "cloud-resource": "vm",
        }

        old_to_new = {}  # old device id → new item id

        for d in devices:
            mapped_type = type_map.get(d.type, d.type)
            result = db.execute(
                text(
                    "INSERT INTO items (type, name, fqdn, ips, platform, status, notes, "
                    "openbao_paths, tags, network_id, created_at, updated_at) "
                    "VALUES (:type, :name, :fqdn, :ips, :platform, :status, :notes, "
                    ":openbao_paths, :tags, :network_id, :created_at, :updated_at)"
                ),
                {
                    "type": mapped_type,
                    "name": d.name,
                    "fqdn": d.fqdn,
                    "ips": d.ips,
                    "platform": d.platform,
                    "status": d.status,
                    "notes": d.notes,
                    "openbao_paths": d.openbao_paths,
                    "tags": d.tags,
                    "network_id": d.network_id,
                    "created_at": d.created_at,
                    "updated_at": d.updated_at,
                },
            )
            old_to_new[d.id] = result.lastrowid

        # Second pass: update parent_ids
        for d in devices:
            if d.parent_id is not None and d.parent_id in old_to_new:
                new_id = old_to_new[d.id]
                new_parent_id = old_to_new[d.parent_id]
                db.execute(
                    text("UPDATE items SET parent_id = :parent_id WHERE id = :id"),
                    {"parent_id": new_parent_id, "id": new_id},
                )

        # --- Migrate endpoints → items ---
        try:
            endpoints = db.execute(text(
                "SELECT id, label, url, protocol, device_id, tags, openbao_paths, notes, "
                "created_at, updated_at FROM endpoints"
            )).fetchall()
            for ep in endpoints:
                parent_id = old_to_new.get(ep.device_id) if ep.device_id else None
                db.execute(
                    text(
                        "INSERT INTO items (type, name, url, protocol, parent_id, tags, "
                        "openbao_paths, notes, created_at, updated_at) "
                        "VALUES ('endpoint', :name, :url, :protocol, :parent_id, :tags, "
                        ":openbao_paths, :notes, :created_at, :updated_at)"
                    ),
                    {
                        "name": ep.label,
                        "url": ep.url,
                        "protocol": ep.protocol,
                        "parent_id": parent_id,
                        "tags": ep.tags,
                        "openbao_paths": ep.openbao_paths,
                        "notes": ep.notes,
                        "created_at": ep.created_at,
                        "updated_at": ep.updated_at,
                    },
                )
        except Exception:
            pass

        # --- Migrate repositories → items ---
        try:
            repos = db.execute(text(
                "SELECT id, name, url, description, platform, tags, openbao_paths, notes, "
                "created_at, updated_at FROM repositories"
            )).fetchall()
            for r in repos:
                db.execute(
                    text(
                        "INSERT INTO items (type, name, url, description, platform, tags, "
                        "openbao_paths, notes, created_at, updated_at) "
                        "VALUES ('repository', :name, :url, :description, :platform, :tags, "
                        ":openbao_paths, :notes, :created_at, :updated_at)"
                    ),
                    {
                        "name": r.name,
                        "url": r.url,
                        "description": r.description,
                        "platform": r.platform,
                        "tags": r.tags,
                        "openbao_paths": r.openbao_paths,
                        "notes": r.notes,
                        "created_at": r.created_at,
                        "updated_at": r.updated_at,
                    },
                )
        except Exception:
            pass

        db.commit()
    finally:
        db.close()


run_migration()

app = FastAPI(title="Atlas", description="Infrastructure Inventory", version="0.1.0", docs_url="/apidocs", redoc_url=None)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Auth middleware
# ---------------------------------------------------------------------------

OPEN_PATHS = {
    "/api/health",
    "/api/auth/status",
    "/api/setup",
    "/api/login",
    "/api/logout",
    "/apidocs",
    "/openapi.json",
    "/mcpdocs",
}

# HA endpoints enforce their own auth (see routers/ha.py): /status is open,
# /demote uses HA_TOKEN, /failover + /backup(s) accept session OR HA_TOKEN.
HA_PREFIX = "/api/ha/"

MCP_PREFIXES = ("/mcp/",)


@app.middleware("http")
async def gateway_middleware(request: Request, call_next):
    path = request.url.path

    # HA middleware: if this node is a standby, block everything except HA
    # endpoints and health.
    if HA_ENABLED and ha.current_role() == "standby":
        if path == "/api/health" or path.startswith(HA_PREFIX) or not path.startswith("/api/"):
            return await call_next(request)
        return JSONResponse(
            {
                "detail": "This node is in standby. Direct writes to the primary.",
                "primary_url": HA_PEER_URL,
            },
            status_code=503,
        )

    # HA endpoints do their own auth.
    if path.startswith(HA_PREFIX):
        return await call_next(request)

    # Always allow open paths and MCP paths (MCP handles its own auth)
    if path in OPEN_PATHS or any(path.startswith(p) for p in MCP_PREFIXES) or not path.startswith("/api/"):
        return await call_next(request)

    # NOAUTH mode — skip all auth
    if NOAUTH:
        return await call_next(request)

    # If first run, block API access until setup is done
    if is_first_run():
        return JSONResponse({"detail": "Setup required"}, status_code=403)

    # Validate bearer token
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return JSONResponse({"detail": "Unauthorized"}, status_code=401)

    token = auth_header[7:]
    if not validate_bearer(token):
        return JSONResponse({"detail": "Invalid or expired token"}, status_code=401)

    return await call_next(request)


# ---------------------------------------------------------------------------
# Lifecycle — start replication + backup scheduler
# ---------------------------------------------------------------------------

@app.on_event("startup")
def _startup():
    ha.on_startup()
    backup.start_scheduler()


# ---------------------------------------------------------------------------
# Routers
# ---------------------------------------------------------------------------

app.include_router(auth.router)
app.include_router(items.router)
app.include_router(networks.router)
app.include_router(export.router)
app.include_router(search.router)
app.include_router(mcp.router)
app.include_router(ha_router.router)


@app.get("/api/health")
def health():
    return {"status": "ok"}


STATIC_DIR = Path("/app/static")

if STATIC_DIR.exists():
    app.mount("/assets", StaticFiles(directory=STATIC_DIR / "assets"), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_frontend(full_path: str):
        file = STATIC_DIR / full_path
        if file.is_file():
            return FileResponse(file)
        return FileResponse(STATIC_DIR / "index.html")

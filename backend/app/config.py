import os

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./atlas.db")
NOAUTH = os.getenv("NOAUTH", "").lower() in ("true", "1", "yes")

# ---------------------------------------------------------------------------
# HA / replication
# ---------------------------------------------------------------------------

HA_ENABLED = os.getenv("HA_ENABLED", "").lower() in ("true", "1", "yes")
HA_SELF_ID = os.getenv("HA_SELF_ID", "A")
HA_INITIAL_ROLE = os.getenv("HA_INITIAL_ROLE", "primary")
HA_REPLICA_URL_SELF = os.getenv("HA_REPLICA_URL_SELF", "")
HA_REPLICA_URL_PEER = os.getenv("HA_REPLICA_URL_PEER", "")
HA_PEER_URL = os.getenv("HA_PEER_URL", "")
HA_TOKEN = os.getenv("HA_TOKEN", "")
HA_STATE_PATH = os.getenv("HA_STATE_PATH", "/data/ha.json")

# ---------------------------------------------------------------------------
# Backups
# ---------------------------------------------------------------------------

BACKUP_DIR = os.getenv("BACKUP_DIR", "/data/backups")
BACKUP_INTERVAL_SECONDS = int(os.getenv("BACKUP_INTERVAL_SECONDS", "900"))
BACKUP_RETENTION_DAYS = int(os.getenv("BACKUP_RETENTION_DAYS", "14"))

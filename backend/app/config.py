import os

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./atlas.db")
NOAUTH = os.getenv("NOAUTH", "").lower() in ("true", "1", "yes")

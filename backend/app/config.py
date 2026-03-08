import os

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./atlas.db")
AUTH_TOKEN = os.getenv("ATLAS_AUTH_TOKEN", "")

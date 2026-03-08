from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import Base, engine
from app.routers import devices, export, networks

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Atlas", description="Infrastructure Inventory", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(devices.router)
app.include_router(networks.router)
app.include_router(export.router)


@app.get("/api/health")
def health():
    return {"status": "ok"}

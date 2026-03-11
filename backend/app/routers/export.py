import csv
import io
import json

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.auth import verify_token
from app.database import get_db
from app.models import Device, Endpoint

router = APIRouter(prefix="/api/export", tags=["export"], dependencies=[Depends(verify_token)])


@router.get("/csv")
def export_csv(db: Session = Depends(get_db)):
    devices = db.query(Device).order_by(Device.name).all()
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "id", "name", "fqdn", "ips", "type", "platform", "status",
        "notes", "openbao_paths", "tags", "parent_id", "network_id",
        "created_at", "updated_at",
    ])
    for d in devices:
        writer.writerow([
            d.id, d.name, d.fqdn or "",
            d.ips or "[]", d.type, d.platform or "", d.status,
            d.notes or "", d.openbao_paths or "[]", d.tags or "[]",
            d.parent_id or "", d.network_id or "",
            d.created_at.isoformat() if d.created_at else "",
            d.updated_at.isoformat() if d.updated_at else "",
        ])
    output.seek(0)
    return StreamingResponse(
        output,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=atlas-inventory.csv"},
    )


@router.get("/endpoints-csv")
def export_endpoints_csv(db: Session = Depends(get_db)):
    endpoints = db.query(Endpoint).order_by(Endpoint.label).all()
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "id", "label", "url", "protocol", "device_id",
        "tags", "openbao_paths", "notes",
        "created_at", "updated_at",
    ])
    for e in endpoints:
        writer.writerow([
            e.id, e.label, e.url, e.protocol or "",
            e.device_id or "",
            e.tags or "[]", e.openbao_paths or "[]",
            e.notes or "",
            e.created_at.isoformat() if e.created_at else "",
            e.updated_at.isoformat() if e.updated_at else "",
        ])
    output.seek(0)
    return StreamingResponse(
        output,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=atlas-endpoints.csv"},
    )

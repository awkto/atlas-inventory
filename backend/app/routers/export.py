import csv
import io

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.auth import verify_token
from app.database import get_db
from app.models import Item

router = APIRouter(prefix="/api/export", tags=["export"], dependencies=[Depends(verify_token)])


@router.get("/csv")
def export_csv(db: Session = Depends(get_db)):
    items = db.query(Item).order_by(Item.name).all()
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "id", "type", "name", "url", "fqdn", "ips", "protocol", "platform", "status",
        "description", "parent_id", "network_id", "tags", "openbao_paths", "notes",
        "created_at", "updated_at",
    ])
    for i in items:
        writer.writerow([
            i.id, i.type, i.name,
            i.url or "", i.fqdn or "",
            i.ips or "[]", i.protocol or "", i.platform or "", i.status or "",
            i.description or "", i.parent_id or "", i.network_id or "",
            i.tags or "[]", i.openbao_paths or "[]", i.notes or "",
            i.created_at.isoformat() if i.created_at else "",
            i.updated_at.isoformat() if i.updated_at else "",
        ])
    output.seek(0)
    return StreamingResponse(
        output,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=atlas-inventory.csv"},
    )

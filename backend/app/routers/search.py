import json
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.auth import verify_token
from app.database import get_db
from app.models import Device, Endpoint
from app.schemas import DeviceOut, EndpointOut

router = APIRouter(prefix="/api/search", tags=["search"], dependencies=[Depends(verify_token)])


def _serialize_device(device: Device) -> DeviceOut:
    data = {c.name: getattr(device, c.name) for c in device.__table__.columns}
    for field in ("ips", "openbao_paths", "tags"):
        val = data.get(field)
        data[field] = json.loads(val) if val else []
    data["network"] = device.network
    return DeviceOut.model_validate(data)


def _serialize_endpoint(endpoint: Endpoint) -> EndpointOut:
    data = {c.name: getattr(endpoint, c.name) for c in endpoint.__table__.columns}
    for field in ("tags", "openbao_paths"):
        val = data.get(field)
        data[field] = json.loads(val) if val else []
    return EndpointOut.model_validate(data)


@router.get("")
def search_by_tag(
    tag: str = Query(...),
    db: Session = Depends(get_db),
):
    pattern = f"%{tag}%"
    devices = db.query(Device).filter(Device.tags.ilike(pattern)).order_by(Device.name).all()
    endpoints = db.query(Endpoint).filter(Endpoint.tags.ilike(pattern)).order_by(Endpoint.label).all()
    return {
        "devices": [_serialize_device(d) for d in devices],
        "endpoints": [_serialize_endpoint(e) for e in endpoints],
    }

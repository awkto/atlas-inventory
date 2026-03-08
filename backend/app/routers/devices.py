import json
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.auth import verify_token
from app.database import get_db
from app.models import Device
from app.schemas import DeviceCreate, DeviceOut, DeviceTree, DeviceUpdate

router = APIRouter(prefix="/api/devices", tags=["devices"], dependencies=[Depends(verify_token)])


def _serialize_json_fields(device: Device) -> dict:
    """Convert JSON text fields to lists for the response."""
    data = {c.name: getattr(device, c.name) for c in device.__table__.columns}
    for field in ("ips", "openbao_paths", "tags"):
        val = data.get(field)
        data[field] = json.loads(val) if val else []
    return data


def _device_to_out(device: Device) -> DeviceOut:
    data = _serialize_json_fields(device)
    data["network"] = device.network
    return DeviceOut.model_validate(data)


def _set_json_fields(data: dict) -> dict:
    for field in ("ips", "openbao_paths", "tags"):
        if field in data and data[field] is not None:
            data[field] = json.dumps(data[field])
    return data


@router.get("", response_model=list[DeviceOut])
def list_devices(
    search: str | None = Query(None),
    type: str | None = Query(None),
    platform: str | None = Query(None),
    status: str | None = Query(None),
    network_id: int | None = Query(None),
    parent_id: int | None = Query(None),
    root_only: bool = Query(False),
    db: Session = Depends(get_db),
):
    q = db.query(Device)
    if search:
        pattern = f"%{search}%"
        q = q.filter(
            or_(
                Device.name.ilike(pattern),
                Device.fqdn.ilike(pattern),
                Device.ips.ilike(pattern),
                Device.tags.ilike(pattern),
            )
        )
    if type:
        q = q.filter(Device.type == type)
    if platform:
        q = q.filter(Device.platform == platform)
    if status:
        q = q.filter(Device.status == status)
    if network_id is not None:
        q = q.filter(Device.network_id == network_id)
    if parent_id is not None:
        q = q.filter(Device.parent_id == parent_id)
    if root_only:
        q = q.filter(Device.parent_id.is_(None))
    devices = q.order_by(Device.name).all()
    return [_device_to_out(d) for d in devices]


@router.get("/tree", response_model=list[DeviceTree])
def device_tree(db: Session = Depends(get_db)):
    """Return all root devices with nested children."""
    roots = db.query(Device).filter(Device.parent_id.is_(None)).order_by(Device.name).all()

    def build_tree(device: Device) -> DeviceTree:
        data = _serialize_json_fields(device)
        data["network"] = device.network
        data["children"] = [build_tree(c) for c in sorted(device.children, key=lambda d: d.name)]
        return DeviceTree.model_validate(data)

    return [build_tree(r) for r in roots]


@router.get("/{device_id}", response_model=DeviceOut)
def get_device(device_id: int, db: Session = Depends(get_db)):
    device = db.get(Device, device_id)
    if not device:
        raise HTTPException(404, "Device not found")
    return _device_to_out(device)


@router.post("", response_model=DeviceOut, status_code=201)
def create_device(payload: DeviceCreate, db: Session = Depends(get_db)):
    data = _set_json_fields(payload.model_dump())
    device = Device(**data)
    db.add(device)
    db.commit()
    db.refresh(device)
    return _device_to_out(device)


@router.put("/{device_id}", response_model=DeviceOut)
def update_device(device_id: int, payload: DeviceUpdate, db: Session = Depends(get_db)):
    device = db.get(Device, device_id)
    if not device:
        raise HTTPException(404, "Device not found")
    data = _set_json_fields(payload.model_dump(exclude_unset=True))
    for key, val in data.items():
        setattr(device, key, val)
    db.commit()
    db.refresh(device)
    return _device_to_out(device)


@router.delete("/{device_id}", status_code=204)
def delete_device(device_id: int, db: Session = Depends(get_db)):
    device = db.get(Device, device_id)
    if not device:
        raise HTTPException(404, "Device not found")
    db.delete(device)
    db.commit()

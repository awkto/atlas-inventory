import json
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.auth import verify_token
from app.database import get_db
from app.models import Endpoint
from app.schemas import EndpointCreate, EndpointOut, EndpointUpdate

router = APIRouter(prefix="/api/endpoints", tags=["endpoints"], dependencies=[Depends(verify_token)])


def _serialize_json_fields(endpoint: Endpoint) -> dict:
    """Convert JSON text fields to lists for the response."""
    data = {c.name: getattr(endpoint, c.name) for c in endpoint.__table__.columns}
    for field in ("tags", "openbao_paths"):
        val = data.get(field)
        data[field] = json.loads(val) if val else []
    return data


def _endpoint_to_out(endpoint: Endpoint) -> EndpointOut:
    data = _serialize_json_fields(endpoint)
    return EndpointOut.model_validate(data)


def _set_json_fields(data: dict) -> dict:
    for field in ("tags", "openbao_paths"):
        if field in data and data[field] is not None:
            data[field] = json.dumps(data[field])
    return data


@router.get("", response_model=list[EndpointOut])
def list_endpoints(
    search: str | None = Query(None),
    protocol: str | None = Query(None),
    device_id: int | None = Query(None),
    db: Session = Depends(get_db),
):
    q = db.query(Endpoint)
    if search:
        pattern = f"%{search}%"
        q = q.filter(
            or_(
                Endpoint.label.ilike(pattern),
                Endpoint.url.ilike(pattern),
                Endpoint.tags.ilike(pattern),
            )
        )
    if protocol:
        q = q.filter(Endpoint.protocol == protocol)
    if device_id is not None:
        q = q.filter(Endpoint.device_id == device_id)
    endpoints = q.order_by(Endpoint.label).all()
    return [_endpoint_to_out(e) for e in endpoints]


@router.get("/{endpoint_id}", response_model=EndpointOut)
def get_endpoint(endpoint_id: int, db: Session = Depends(get_db)):
    endpoint = db.get(Endpoint, endpoint_id)
    if not endpoint:
        raise HTTPException(404, "Endpoint not found")
    return _endpoint_to_out(endpoint)


@router.post("", response_model=EndpointOut, status_code=201)
def create_endpoint(payload: EndpointCreate, db: Session = Depends(get_db)):
    data = _set_json_fields(payload.model_dump())
    endpoint = Endpoint(**data)
    db.add(endpoint)
    db.commit()
    db.refresh(endpoint)
    return _endpoint_to_out(endpoint)


@router.put("/{endpoint_id}", response_model=EndpointOut)
def update_endpoint(endpoint_id: int, payload: EndpointUpdate, db: Session = Depends(get_db)):
    endpoint = db.get(Endpoint, endpoint_id)
    if not endpoint:
        raise HTTPException(404, "Endpoint not found")
    data = _set_json_fields(payload.model_dump(exclude_unset=True))
    for key, val in data.items():
        setattr(endpoint, key, val)
    db.commit()
    db.refresh(endpoint)
    return _endpoint_to_out(endpoint)


@router.delete("/{endpoint_id}", status_code=204)
def delete_endpoint(endpoint_id: int, db: Session = Depends(get_db)):
    endpoint = db.get(Endpoint, endpoint_id)
    if not endpoint:
        raise HTTPException(404, "Endpoint not found")
    db.delete(endpoint)
    db.commit()

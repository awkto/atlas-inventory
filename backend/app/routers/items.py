import json
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.auth import verify_token
from app.database import get_db
from app.models import Item
from app.schemas import ItemCreate, ItemOut, ItemUpdate

router = APIRouter(prefix="/api/items", tags=["items"], dependencies=[Depends(verify_token)])


def _serialize_json_fields(item: Item) -> dict:
    """Convert JSON text fields to lists for the response."""
    data = {c.name: getattr(item, c.name) for c in item.__table__.columns}
    for field in ("ips", "openbao_paths", "tags"):
        val = data.get(field)
        data[field] = json.loads(val) if val else []
    return data


def _item_to_out(item: Item) -> ItemOut:
    data = _serialize_json_fields(item)
    data["network"] = item.network
    return ItemOut.model_validate(data)


def _set_json_fields(data: dict) -> dict:
    for field in ("ips", "openbao_paths", "tags"):
        if field in data and data[field] is not None:
            data[field] = json.dumps(data[field])
    return data


@router.get("", response_model=list[ItemOut])
def list_items(
    search: str | None = Query(None),
    type: str | None = Query(None),
    platform: str | None = Query(None),
    status: str | None = Query(None),
    parent_id: int | None = Query(None),
    tag: str | None = Query(None),
    db: Session = Depends(get_db),
):
    q = db.query(Item)
    if search:
        pattern = f"%{search}%"
        q = q.filter(
            or_(
                Item.name.ilike(pattern),
                Item.fqdn.ilike(pattern),
                Item.url.ilike(pattern),
                Item.description.ilike(pattern),
                Item.tags.ilike(pattern),
            )
        )
    if type:
        q = q.filter(Item.type == type)
    if platform:
        q = q.filter(Item.platform == platform)
    if status:
        q = q.filter(Item.status == status)
    if parent_id is not None:
        q = q.filter(Item.parent_id == parent_id)
    if tag:
        q = q.filter(Item.tags.ilike(f"%{tag}%"))
    items = q.order_by(Item.name).all()
    return [_item_to_out(i) for i in items]


@router.get("/{item_id}", response_model=ItemOut)
def get_item(item_id: int, db: Session = Depends(get_db)):
    item = db.get(Item, item_id)
    if not item:
        raise HTTPException(404, "Item not found")
    return _item_to_out(item)


@router.post("", response_model=ItemOut, status_code=201)
def create_item(payload: ItemCreate, db: Session = Depends(get_db)):
    data = _set_json_fields(payload.model_dump())
    item = Item(**data)
    db.add(item)
    db.commit()
    db.refresh(item)
    return _item_to_out(item)


@router.put("/{item_id}", response_model=ItemOut)
def update_item(item_id: int, payload: ItemUpdate, db: Session = Depends(get_db)):
    item = db.get(Item, item_id)
    if not item:
        raise HTTPException(404, "Item not found")
    data = _set_json_fields(payload.model_dump(exclude_unset=True))
    for key, val in data.items():
        setattr(item, key, val)
    db.commit()
    db.refresh(item)
    return _item_to_out(item)


@router.delete("/{item_id}", status_code=204)
def delete_item(item_id: int, db: Session = Depends(get_db)):
    item = db.get(Item, item_id)
    if not item:
        raise HTTPException(404, "Item not found")
    db.delete(item)
    db.commit()

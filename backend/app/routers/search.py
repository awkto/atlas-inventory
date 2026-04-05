import json
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Item
from app.schemas import ItemOut

router = APIRouter(prefix="/api/search", tags=["search"])


def _item_to_out(item: Item) -> ItemOut:
    data = {c.name: getattr(item, c.name) for c in item.__table__.columns}
    for field in ("ips", "openbao_paths", "tags", "ports"):
        val = data.get(field)
        data[field] = json.loads(val) if val else []
    data["network"] = item.network
    return ItemOut.model_validate(data)


@router.get("")
def search_by_tag(
    tag: str = Query(...),
    db: Session = Depends(get_db),
):
    pattern = f"%{tag}%"
    items = db.query(Item).filter(Item.tags.ilike(pattern)).order_by(Item.name).all()
    return {"items": [_item_to_out(i) for i in items]}

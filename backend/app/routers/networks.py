from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth import verify_token
from app.database import get_db
from app.models import Network
from app.schemas import NetworkCreate, NetworkOut, NetworkUpdate

router = APIRouter(prefix="/api/networks", tags=["networks"], dependencies=[Depends(verify_token)])


@router.get("", response_model=list[NetworkOut])
def list_networks(db: Session = Depends(get_db)):
    return db.query(Network).order_by(Network.name).all()


@router.get("/{network_id}", response_model=NetworkOut)
def get_network(network_id: int, db: Session = Depends(get_db)):
    network = db.get(Network, network_id)
    if not network:
        raise HTTPException(404, "Network not found")
    return network


@router.post("", response_model=NetworkOut, status_code=201)
def create_network(payload: NetworkCreate, db: Session = Depends(get_db)):
    network = Network(**payload.model_dump())
    db.add(network)
    db.commit()
    db.refresh(network)
    return network


@router.put("/{network_id}", response_model=NetworkOut)
def update_network(network_id: int, payload: NetworkUpdate, db: Session = Depends(get_db)):
    network = db.get(Network, network_id)
    if not network:
        raise HTTPException(404, "Network not found")
    for key, val in payload.model_dump(exclude_unset=True).items():
        setattr(network, key, val)
    db.commit()
    db.refresh(network)
    return network


@router.delete("/{network_id}", status_code=204)
def delete_network(network_id: int, db: Session = Depends(get_db)):
    network = db.get(Network, network_id)
    if not network:
        raise HTTPException(404, "Network not found")
    db.delete(network)
    db.commit()

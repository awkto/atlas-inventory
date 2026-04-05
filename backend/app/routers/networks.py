import ipaddress

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Network, Range
from app.schemas import NetworkCreate, NetworkOut, NetworkUpdate, RangeCreate, RangeOut, RangeUpdate


def _validate_range_in_network(cidr: str, start_ip: str, end_ip: str):
    try:
        net = ipaddress.ip_network(cidr, strict=False)
        start = ipaddress.ip_address(start_ip)
        end = ipaddress.ip_address(end_ip)
    except ValueError as e:
        raise HTTPException(400, f"Invalid IP address or CIDR: {e}")
    if start not in net:
        raise HTTPException(400, f"{start_ip} is outside network {cidr}")
    if end not in net:
        raise HTTPException(400, f"{end_ip} is outside network {cidr}")
    if start > end:
        raise HTTPException(400, f"Start IP {start_ip} is greater than end IP {end_ip}")

router = APIRouter(prefix="/api/networks", tags=["networks"])


def _sort_network_ranges(network: Network) -> Network:
    network.ranges.sort(key=lambda r: ipaddress.ip_address(r.start_ip))
    return network


@router.get("", response_model=list[NetworkOut])
def list_networks(db: Session = Depends(get_db)):
    networks = db.query(Network).order_by(Network.name).all()
    for n in networks:
        _sort_network_ranges(n)
    return networks


@router.get("/{network_id}", response_model=NetworkOut)
def get_network(network_id: int, db: Session = Depends(get_db)):
    network = db.get(Network, network_id)
    if not network:
        raise HTTPException(404, "Network not found")
    _sort_network_ranges(network)
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


# --- Ranges (nested under networks) ---

@router.get("/{network_id}/ranges", response_model=list[RangeOut])
def list_ranges(network_id: int, db: Session = Depends(get_db)):
    network = db.get(Network, network_id)
    if not network:
        raise HTTPException(404, "Network not found")
    ranges = db.query(Range).filter(Range.network_id == network_id).all()
    ranges.sort(key=lambda r: ipaddress.ip_address(r.start_ip))
    return ranges


@router.post("/{network_id}/ranges", response_model=RangeOut, status_code=201)
def create_range(network_id: int, payload: RangeCreate, db: Session = Depends(get_db)):
    network = db.get(Network, network_id)
    if not network:
        raise HTTPException(404, "Network not found")
    _validate_range_in_network(network.cidr, payload.start_ip, payload.end_ip)
    r = Range(network_id=network_id, **payload.model_dump())
    db.add(r)
    db.commit()
    db.refresh(r)
    return r


@router.put("/{network_id}/ranges/{range_id}", response_model=RangeOut)
def update_range(network_id: int, range_id: int, payload: RangeUpdate, db: Session = Depends(get_db)):
    r = db.query(Range).filter(Range.id == range_id, Range.network_id == network_id).first()
    if not r:
        raise HTTPException(404, "Range not found")
    new_start = payload.start_ip if payload.start_ip is not None else r.start_ip
    new_end = payload.end_ip if payload.end_ip is not None else r.end_ip
    network = db.get(Network, network_id)
    _validate_range_in_network(network.cidr, new_start, new_end)
    for key, val in payload.model_dump(exclude_unset=True).items():
        setattr(r, key, val)
    db.commit()
    db.refresh(r)
    return r


@router.delete("/{network_id}/ranges/{range_id}", status_code=204)
def delete_range(network_id: int, range_id: int, db: Session = Depends(get_db)):
    r = db.query(Range).filter(Range.id == range_id, Range.network_id == network_id).first()
    if not r:
        raise HTTPException(404, "Range not found")
    db.delete(r)
    db.commit()

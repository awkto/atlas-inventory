from datetime import datetime
from pydantic import BaseModel


# --- Network ---

class NetworkBase(BaseModel):
    name: str
    cidr: str
    description: str | None = None


class NetworkCreate(NetworkBase):
    pass


class NetworkUpdate(BaseModel):
    name: str | None = None
    cidr: str | None = None
    description: str | None = None


# --- Range ---

class RangeBase(BaseModel):
    label: str
    start_ip: str
    end_ip: str
    description: str | None = None


class RangeCreate(RangeBase):
    pass


class RangeUpdate(BaseModel):
    label: str | None = None
    start_ip: str | None = None
    end_ip: str | None = None
    description: str | None = None


class RangeOut(RangeBase):
    id: int
    network_id: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class NetworkOut(NetworkBase):
    id: int
    created_at: datetime
    updated_at: datetime
    ranges: list[RangeOut] = []

    model_config = {"from_attributes": True}


# --- Item ---

class ItemBase(BaseModel):
    type: str
    name: str
    url: str | None = None
    fqdn: str | None = None
    ips: list[str] = []
    protocol: str | None = None
    platform: str | None = None
    status: str | None = None
    description: str | None = None
    parent_id: int | None = None
    network_id: int | None = None
    vmid: int | None = None
    ports: list[str] = []
    tags: list[str] = []
    openbao_paths: list[str] = []
    notes: str | None = None


class ItemCreate(ItemBase):
    pass


class ItemUpdate(BaseModel):
    type: str | None = None
    name: str | None = None
    url: str | None = None
    fqdn: str | None = None
    ips: list[str] | None = None
    protocol: str | None = None
    platform: str | None = None
    status: str | None = None
    description: str | None = None
    parent_id: int | None = None
    network_id: int | None = None
    vmid: int | None = None
    ports: list[str] | None = None
    tags: list[str] | None = None
    openbao_paths: list[str] | None = None
    notes: str | None = None


class ItemOut(ItemBase):
    id: int
    created_at: datetime
    updated_at: datetime
    network: NetworkOut | None = None

    model_config = {"from_attributes": True}

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


# --- Device ---

class DeviceBase(BaseModel):
    name: str
    fqdn: str | None = None
    ips: list[str] = []
    type: str  # server, container, service, network-device, vm, cloud-resource
    platform: str | None = None
    status: str = "active"
    notes: str | None = None
    openbao_paths: list[str] = []
    tags: list[str] = []
    parent_id: int | None = None
    network_id: int | None = None


class DeviceCreate(DeviceBase):
    pass


class DeviceUpdate(BaseModel):
    name: str | None = None
    fqdn: str | None = None
    ips: list[str] | None = None
    type: str | None = None
    platform: str | None = None
    status: str | None = None
    notes: str | None = None
    openbao_paths: list[str] | None = None
    tags: list[str] | None = None
    parent_id: int | None = None
    network_id: int | None = None


class DeviceOut(DeviceBase):
    id: int
    created_at: datetime
    updated_at: datetime
    network: NetworkOut | None = None

    model_config = {"from_attributes": True}


class DeviceTree(DeviceOut):
    children: list["DeviceTree"] = []

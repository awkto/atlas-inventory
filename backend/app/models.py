import datetime
from sqlalchemy import DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Network(Base):
    __tablename__ = "networks"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255), unique=True)
    cidr: Mapped[str] = mapped_column(String(64))
    description: Mapped[str | None] = mapped_column(Text, default=None)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime.datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    devices: Mapped[list["Device"]] = relationship(back_populates="network")
    ranges: Mapped[list["Range"]] = relationship(back_populates="network", cascade="all, delete-orphan")


class Range(Base):
    __tablename__ = "ranges"

    id: Mapped[int] = mapped_column(primary_key=True)
    network_id: Mapped[int] = mapped_column(ForeignKey("networks.id", ondelete="CASCADE"))
    label: Mapped[str] = mapped_column(String(255))
    start_ip: Mapped[str] = mapped_column(String(64))
    end_ip: Mapped[str] = mapped_column(String(64))
    description: Mapped[str | None] = mapped_column(Text, default=None)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime.datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    network: Mapped["Network"] = relationship(back_populates="ranges")


class Device(Base):
    __tablename__ = "devices"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255))
    fqdn: Mapped[str | None] = mapped_column(String(512), default=None)
    ips: Mapped[str | None] = mapped_column(Text, default=None)  # JSON array stored as text
    type: Mapped[str] = mapped_column(String(64))  # server, container, service, network-device, vm, cloud-resource
    platform: Mapped[str | None] = mapped_column(String(128), default=None)
    status: Mapped[str] = mapped_column(String(32), default="active")
    notes: Mapped[str | None] = mapped_column(Text, default=None)
    openbao_paths: Mapped[str | None] = mapped_column(Text, default=None)  # JSON array
    tags: Mapped[str | None] = mapped_column(Text, default=None)  # JSON array

    parent_id: Mapped[int | None] = mapped_column(ForeignKey("devices.id", ondelete="SET NULL"), default=None)
    network_id: Mapped[int | None] = mapped_column(ForeignKey("networks.id", ondelete="SET NULL"), default=None)

    created_at: Mapped[datetime.datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime.datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    parent: Mapped["Device | None"] = relationship("Device", remote_side=[id], back_populates="children")
    children: Mapped[list["Device"]] = relationship("Device", back_populates="parent")
    network: Mapped["Network | None"] = relationship(back_populates="devices")
    endpoints: Mapped[list["Endpoint"]] = relationship(back_populates="device")


class Repository(Base):
    __tablename__ = "repositories"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255))
    url: Mapped[str] = mapped_column(String(1024))
    description: Mapped[str | None] = mapped_column(Text, default=None)
    platform: Mapped[str | None] = mapped_column(String(64), default=None)  # github, gitlab, gitea, etc.
    tags: Mapped[str | None] = mapped_column(Text, default=None)  # JSON array
    openbao_paths: Mapped[str | None] = mapped_column(Text, default=None)  # JSON array
    notes: Mapped[str | None] = mapped_column(Text, default=None)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime.datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())


class Endpoint(Base):
    __tablename__ = "endpoints"

    id: Mapped[int] = mapped_column(primary_key=True)
    label: Mapped[str] = mapped_column(String(255))
    url: Mapped[str] = mapped_column(String(1024))
    protocol: Mapped[str | None] = mapped_column(String(64), default=None)  # http, https, ssh, tcp, etc.
    device_id: Mapped[int | None] = mapped_column(ForeignKey("devices.id", ondelete="SET NULL"), default=None)
    tags: Mapped[str | None] = mapped_column(Text, default=None)  # JSON array
    openbao_paths: Mapped[str | None] = mapped_column(Text, default=None)  # JSON array
    notes: Mapped[str | None] = mapped_column(Text, default=None)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime.datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    device: Mapped["Device | None"] = relationship(back_populates="endpoints")

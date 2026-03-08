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

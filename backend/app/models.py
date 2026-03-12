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

    items: Mapped[list["Item"]] = relationship(back_populates="network")
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


class Item(Base):
    __tablename__ = "items"

    id: Mapped[int] = mapped_column(primary_key=True)
    type: Mapped[str] = mapped_column(String(64))  # server, vm, container, service, device, endpoint, repository, secret, document
    name: Mapped[str] = mapped_column(String(255))
    url: Mapped[str | None] = mapped_column(String(1024), default=None)
    fqdn: Mapped[str | None] = mapped_column(String(512), default=None)
    ips: Mapped[str | None] = mapped_column(Text, default=None)  # JSON array stored as text
    protocol: Mapped[str | None] = mapped_column(String(64), default=None)
    platform: Mapped[str | None] = mapped_column(String(128), default=None)
    status: Mapped[str | None] = mapped_column(String(32), default=None)
    description: Mapped[str | None] = mapped_column(Text, default=None)
    parent_id: Mapped[int | None] = mapped_column(ForeignKey("items.id", ondelete="SET NULL"), default=None)
    network_id: Mapped[int | None] = mapped_column(ForeignKey("networks.id", ondelete="SET NULL"), default=None)
    tags: Mapped[str | None] = mapped_column(Text, default=None)  # JSON array
    openbao_paths: Mapped[str | None] = mapped_column(Text, default=None)  # JSON array
    notes: Mapped[str | None] = mapped_column(Text, default=None)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime.datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    parent: Mapped["Item | None"] = relationship("Item", remote_side=[id], back_populates="children")
    children: Mapped[list["Item"]] = relationship("Item", back_populates="parent")
    network: Mapped["Network | None"] = relationship(back_populates="items")

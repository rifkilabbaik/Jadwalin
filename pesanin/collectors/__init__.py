"""Daftar collector yang tersedia."""

from __future__ import annotations

from sqlalchemy.orm import Session

from .base import Collector, HasilCollect
from .inbox import InboxCollector


def semua_collector() -> list[Collector]:
    return [InboxCollector()]


def jalankan_semua(db: Session, hanya: list[str] | None = None) -> list[HasilCollect]:
    hasil = []
    for c in semua_collector():
        if hanya and c.nama not in hanya:
            continue
        hasil.append(c.jalankan(db))
    return hasil

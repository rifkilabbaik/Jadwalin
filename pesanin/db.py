"""Koneksi SQLite dan sesi database."""

from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path

from sqlalchemy import Engine, create_engine, event
from sqlalchemy.orm import Session, sessionmaker

from . import config
from .models import Base

_engine: Engine | None = None
_SessionLocal: sessionmaker[Session] | None = None


def _buat_engine(url: str) -> Engine:
    connect_args = {}
    if url.startswith("sqlite"):
        connect_args = {"check_same_thread": False, "timeout": 15}
        if url.startswith("sqlite:///") and url != "sqlite:///:memory:":
            Path(url.removeprefix("sqlite:///")).parent.mkdir(parents=True, exist_ok=True)
    engine = create_engine(url, connect_args=connect_args)

    if url.startswith("sqlite"):

        @event.listens_for(engine, "connect")
        def _pragma(conn, _record):
            cur = conn.cursor()
            cur.execute("PRAGMA foreign_keys=ON")
            cur.close()

    return engine


def inisialisasi(url: str | None = None) -> Engine:
    """Buat engine, tabel, dan isi default. Aman dipanggil berkali-kali."""
    global _engine, _SessionLocal
    if _engine is not None and url is None:
        return _engine
    if _engine is not None:
        _engine.dispose()
    _engine = _buat_engine(url or config.DB_URL)
    _SessionLocal = sessionmaker(bind=_engine, expire_on_commit=False)
    Base.metadata.create_all(_engine)

    from .layanan import siapkan_default

    with _SessionLocal() as s:
        siapkan_default(s)
        s.commit()
    return _engine


def buka_sesi() -> Session:
    inisialisasi()
    assert _SessionLocal is not None
    return _SessionLocal()


@contextmanager
def sesi() -> Iterator[Session]:
    """Sesi dengan commit otomatis di akhir blok (rollback jika error)."""
    s = buka_sesi()
    try:
        yield s
        s.commit()
    except Exception:
        s.rollback()
        raise
    finally:
        s.close()

"""Konfigurasi dasar: lokasi folder, isi .env, dan jam lokal (WIB)."""

from __future__ import annotations

import os
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")

DATA_DIR = Path(os.getenv("PESANIN_DATA_DIR") or BASE_DIR / "data")
MEDIA_DIR = Path(os.getenv("PESANIN_MEDIA_DIR") or BASE_DIR / "media")
INBOX_DIR = Path(os.getenv("PESANIN_INBOX_DIR") or BASE_DIR / "inbox")
DB_URL = os.getenv("PESANIN_DB_URL") or f"sqlite:///{DATA_DIR / 'pesanin.db'}"

IG_ACCESS_TOKEN = os.getenv("IG_ACCESS_TOKEN", "").strip()
IG_USER_ID = os.getenv("IG_USER_ID", "").strip()
GRAPH_API_VERSION = os.getenv("GRAPH_API_VERSION", "").strip() or "v23.0"

# Indonesia bagian barat tidak memakai DST, jadi offset tetap +7 sudah tepat
# (dan tidak butuh paket tzdata di Windows).
WIB = timezone(timedelta(hours=7), "WIB")


def sekarang() -> datetime:
    """Waktu sekarang dalam WIB, tanpa info zona (disimpan apa adanya di SQLite)."""
    return datetime.now(WIB).replace(tzinfo=None)


def hari_ini() -> date:
    return sekarang().date()


def graph_api_aktif() -> bool:
    return bool(IG_ACCESS_TOKEN and IG_USER_ID)

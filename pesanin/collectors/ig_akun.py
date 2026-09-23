"""Collector Instagram Graph API: Business Discovery (postingan terbaru akun pantauan)."""

from __future__ import annotations

from collections.abc import Callable
from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import config
from ..models import AkunPantauan
from .base import Collector, HasilCollect
from .instagram import GraphAPIError, GraphClient, klien_default, simpan_media, waktu_ig

JUMLAH_MEDIA = 25
# Postingan yang lebih tua dari ini tidak diambil (acaranya kemungkinan sudah lewat).
MAKS_UMUR_HARI = 30
FIELD_MEDIA = "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,children{media_type,media_url}"


class AkunCollector(Collector):
    """Hanya bisa membaca akun Instagram Bisnis/Kreator (batasan resmi Business Discovery)."""

    nama = "ig_akun"
    label = "Akun pantauan"

    def __init__(self, buat_klien: Callable[[], GraphClient] = klien_default):
        self.buat_klien = buat_klien

    def cek_aktif(self, db: Session) -> tuple[bool, str]:
        if not config.graph_api_aktif():
            return False, "IG_ACCESS_TOKEN / IG_USER_ID belum diisi di .env"
        n = len(db.scalars(select(AkunPantauan).where(AkunPantauan.aktif.is_(True))).all())
        if n == 0:
            return False, "belum ada akun pantauan aktif di Pengaturan"
        return True, f"{n} akun aktif"

    def collect(self, db: Session, hasil: HasilCollect) -> None:
        klien = self.buat_klien()
        batas_umur = config.sekarang() - timedelta(days=MAKS_UMUR_HARI)
        daftar = db.scalars(
            select(AkunPantauan)
            .where(AkunPantauan.aktif.is_(True))
            .order_by(AkunPantauan.terakhir_dicek.is_not(None), AkunPantauan.terakhir_dicek)
        ).all()
        for akun in daftar:
            fields = f"business_discovery.username({akun.username}){{username,media.limit({JUMLAH_MEDIA}){{{FIELD_MEDIA}}}}}"
            try:
                data = klien.get(config.IG_USER_ID, fields=fields)
            except GraphAPIError as e:
                akun.pesan_terakhir = str(e)[:300]
                akun.terakhir_dicek = config.sekarang()
                db.commit()
                hasil.galat.append(f"@{akun.username}: {e}")
                if e.harus_berhenti:
                    break
                continue
            media = (data.get("business_discovery") or {}).get("media", {}).get("data", [])
            baru_sebelum = hasil.baru
            segar = [m for m in media if (waktu_ig(m.get("timestamp")) or config.sekarang()) >= batas_umur]
            for m in segar:
                simpan_media(db, klien, m, hasil, sumber="ig_akun", sumber_ref=f"@{akun.username}", akun_ig=akun.username)
            akun.pesan_terakhir = f"{len(segar)} media {MAKS_UMUR_HARI} hari terakhir, {hasil.baru - baru_sebelum} baru"
            akun.terakhir_dicek = config.sekarang()
            db.commit()

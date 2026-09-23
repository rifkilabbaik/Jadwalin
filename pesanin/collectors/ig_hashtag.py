"""Collector Instagram Graph API: Hashtag Search (recent_media)."""

from __future__ import annotations

from collections.abc import Callable

from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import config, layanan
from ..konstanta import BATAS_HASHTAG_UNIK
from ..models import Hashtag
from .base import Collector, HasilCollect
from .instagram import GraphAPIError, GraphClient, klien_default, simpan_media

FIELD_MEDIA = "id,caption,media_type,media_url,permalink,timestamp,children{media_type,media_url}"


class HashtagCollector(Collector):
    """Ambil postingan 24 jam terakhir dari tiap hashtag aktif.

    Instagram membatasi 30 hashtag unik per akun per 7 hari (bergulir). Setiap
    hashtag yang di-query dicatat, dan hashtag baru dilewati bila batas tercapai.
    """

    nama = "ig_hashtag"
    label = "Hashtag IG"

    def __init__(self, buat_klien: Callable[[], GraphClient] = klien_default):
        self.buat_klien = buat_klien

    def cek_aktif(self, db: Session) -> tuple[bool, str]:
        if not config.graph_api_aktif():
            return False, "IG_ACCESS_TOKEN / IG_USER_ID belum diisi di .env"
        n = len(db.scalars(select(Hashtag).where(Hashtag.aktif.is_(True))).all())
        if n == 0:
            return False, "belum ada hashtag aktif di Pengaturan"
        return True, f"{n} hashtag aktif"

    def collect(self, db: Session, hasil: HasilCollect) -> None:
        klien = self.buat_klien()
        daftar = db.scalars(
            select(Hashtag).where(Hashtag.aktif.is_(True)).order_by(Hashtag.terakhir_dicek.is_not(None), Hashtag.terakhir_dicek)
        ).all()
        terpakai = set(layanan.pemakaian_hashtag(db))
        dilewati = []
        for tag in daftar:
            if tag.nama not in terpakai and len(terpakai) >= BATAS_HASHTAG_UNIK:
                dilewati.append(tag.nama)
                continue
            baru_sebelum = hasil.baru
            # Dicatat sebelum query: pencarian yang gagal pun ikut dihitung Instagram.
            layanan.catat_pemakaian_hashtag(db, tag.nama)
            terpakai.add(tag.nama)
            try:
                if not tag.ig_hashtag_id:
                    data = klien.get("ig_hashtag_search", user_id=config.IG_USER_ID, q=tag.nama)
                    if not data.get("data"):
                        tag.pesan_terakhir = "Hashtag tidak ditemukan di Instagram"
                        tag.terakhir_dicek = config.sekarang()
                        db.commit()
                        continue
                    tag.ig_hashtag_id = data["data"][0]["id"]
                    db.commit()
                media = klien.get(
                    f"{tag.ig_hashtag_id}/recent_media", user_id=config.IG_USER_ID, fields=FIELD_MEDIA, limit=50
                ).get("data", [])
            except GraphAPIError as e:
                tag.pesan_terakhir = str(e)[:300]
                tag.terakhir_dicek = config.sekarang()
                db.commit()
                hasil.galat.append(f"#{tag.nama}: {e}")
                if e.harus_berhenti:
                    break
                continue
            for m in media:
                simpan_media(db, klien, m, hasil, sumber="ig_hashtag", sumber_ref=f"#{tag.nama}")
            tag.pesan_terakhir = f"{len(media)} media 24 jam terakhir, {hasil.baru - baru_sebelum} baru"
            tag.terakhir_dicek = config.sekarang()
            db.commit()
        if dilewati:
            hasil.galat.append(
                f"Batas {BATAS_HASHTAG_UNIK} hashtag unik/7 hari tercapai; dilewati: "
                + ", ".join(f"#{n}" for n in dilewati)
            )

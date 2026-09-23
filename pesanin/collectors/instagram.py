"""Klien kecil Instagram Graph API (hanya baca) dan penyimpanan media.

Hanya memakai endpoint resmi: Hashtag Search dan Business Discovery. Tidak ada
scraping, tidak ada pengiriman pesan, tidak ada aksi like/comment/follow.
"""

from __future__ import annotations

from datetime import datetime

import requests
from sqlalchemy.orm import Session

from .. import config, layanan
from ..konstanta import MAKS_UKURAN_GAMBAR
from .base import HasilCollect

# Kode galat Graph API yang berarti sebaiknya berhenti dulu.
KODE_BATAS_PANGGILAN = {4, 17, 32, 613}
KODE_TOKEN = {190}


class GraphAPIError(Exception):
    def __init__(self, pesan: str, kode: int | None = None, subkode: int | None = None):
        super().__init__(pesan)
        self.kode = kode
        self.subkode = subkode

    @property
    def harus_berhenti(self) -> bool:
        return self.kode in KODE_BATAS_PANGGILAN or self.kode in KODE_TOKEN

    def __str__(self) -> str:
        pesan = super().__str__()
        if self.kode in KODE_TOKEN:
            return f"Token tidak valid atau kedaluwarsa, perbarui IG_ACCESS_TOKEN di .env ({pesan})"
        if self.kode in KODE_BATAS_PANGGILAN:
            return f"Batas panggilan API tercapai, coba lagi nanti ({pesan})"
        return pesan


class GraphClient:
    def __init__(self, token: str, versi: str, sesi: requests.Session | None = None, timeout: int = 20):
        self.token = token
        self.dasar = f"https://graph.facebook.com/{versi}"
        self.sesi = sesi or requests.Session()
        self.timeout = timeout

    def get(self, path: str, **params) -> dict:
        params["access_token"] = self.token
        try:
            r = self.sesi.get(f"{self.dasar}/{path}", params=params, timeout=self.timeout)
        except requests.RequestException as e:
            raise GraphAPIError(f"Tidak bisa terhubung ke Graph API: {e}") from None
        try:
            data = r.json()
        except ValueError:
            raise GraphAPIError(f"Balasan Graph API bukan JSON (HTTP {r.status_code})") from None
        if "error" in data:
            err = data["error"]
            raise GraphAPIError(err.get("message", "galat tidak dikenal"), err.get("code"), err.get("error_subcode"))
        if r.status_code != 200:
            raise GraphAPIError(f"HTTP {r.status_code}")
        return data

    def unduh_gambar(self, url: str) -> bytes | None:
        """Unduh gambar poster. None jika gagal atau bukan gambar (mis. video)."""
        try:
            with self.sesi.get(url, timeout=self.timeout, stream=True) as r:
                if r.status_code != 200:
                    return None
                data = b""
                for potongan in r.iter_content(64 * 1024):
                    data += potongan
                    if len(data) > MAKS_UKURAN_GAMBAR:
                        return None
        except requests.RequestException:
            return None
        return data if layanan.deteksi_ekstensi(data) else None


def klien_default() -> GraphClient:
    return GraphClient(config.IG_ACCESS_TOKEN, config.GRAPH_API_VERSION)


def url_gambar(media: dict) -> str | None:
    """Pilih gambar yang paling mungkin berisi poster."""
    jenis = media.get("media_type")
    if jenis == "IMAGE":
        return media.get("media_url")
    if jenis == "VIDEO":
        return media.get("thumbnail_url")
    if jenis == "CAROUSEL_ALBUM":
        for anak in (media.get("children") or {}).get("data", []):
            if anak.get("media_type") == "IMAGE" and anak.get("media_url"):
                return anak["media_url"]
    return media.get("media_url") or media.get("thumbnail_url")


def waktu_ig(teks: str | None) -> datetime | None:
    """'2026-09-22T10:00:00+0000' -> datetime WIB tanpa zona."""
    if not teks:
        return None
    try:
        return datetime.strptime(teks, "%Y-%m-%dT%H:%M:%S%z").astimezone(config.WIB).replace(tzinfo=None)
    except ValueError:
        return None


def simpan_media(
    db: Session,
    klien: GraphClient,
    media: dict,
    hasil: HasilCollect,
    *,
    sumber: str,
    sumber_ref: str,
    akun_ig: str | None = None,
) -> None:
    permalink = media.get("permalink")
    if permalink and layanan.permalink_sudah_ada(db, permalink):
        hasil.duplikat += 1
        return
    url = url_gambar(media)
    gambar = klien.unduh_gambar(url) if url else None
    try:
        h = layanan.tambah_postingan(
            db,
            sumber=sumber,
            sumber_ref=sumber_ref,
            permalink=permalink,
            caption=media.get("caption"),
            akun_ig=akun_ig or media.get("username"),
            gambar=gambar,
            tanggal_posting=waktu_ig(media.get("timestamp")),
            ig_media_id=media.get("id"),
            cek_pengecualian=True,
        )
        db.commit()
    except ValueError as e:
        db.rollback()
        hasil.galat.append(f"{permalink or media.get('id')}: {e}")
        return
    hasil.catat(h)

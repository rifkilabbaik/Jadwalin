"""Logika inti yang dipakai bersama oleh CLI, collector, dan dashboard."""

from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from pathlib import Path

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from . import config, normalisasi
from .config import hari_ini, sekarang
from .konstanta import (
    DEFAULT_HASHTAG,
    JENDELA_HASHTAG_HARI,
    DEFAULT_PENGATURAN,
    DEFAULT_PENGECUALIAN,
    MAKS_UKURAN_GAMBAR,
    STATUS,
    STATUS_AKTIF,
    STATUS_DIHUBUNGI,
    SUMBER,
)
from .models import (
    Hashtag,
    KataPengecualian,
    PemakaianHashtag,
    Pengaturan,
    Postingan,
    RiwayatStatus,
)

# ---------------------------------------------------------------------------
# Pengaturan
# ---------------------------------------------------------------------------

_KUNCI_DEFAULT_DIBUAT = "default_dibuat"


def siapkan_default(db: Session) -> None:
    """Isi hashtag dan kata pengecualian awal, hanya sekali saat database baru."""
    if db.get(Pengaturan, _KUNCI_DEFAULT_DIBUAT):
        return
    for nama in DEFAULT_HASHTAG:
        db.add(Hashtag(nama=nama))
    for kata in DEFAULT_PENGECUALIAN:
        db.add(KataPengecualian(kata=kata))
    db.add(Pengaturan(kunci=_KUNCI_DEFAULT_DIBUAT, nilai="1"))


def ambil_pengaturan(db: Session) -> dict[str, int]:
    tersimpan = {p.kunci: p.nilai for p in db.scalars(select(Pengaturan))}
    hasil = {}
    for kunci, default in DEFAULT_PENGATURAN.items():
        try:
            hasil[kunci] = int(tersimpan.get(kunci, default))
        except ValueError:
            hasil[kunci] = default
    return hasil


def simpan_pengaturan(db: Session, **nilai: int) -> None:
    for kunci, isi in nilai.items():
        if kunci not in DEFAULT_PENGATURAN:
            raise KeyError(kunci)
        baris = db.get(Pengaturan, kunci)
        if baris is None:
            db.add(Pengaturan(kunci=kunci, nilai=str(isi)))
        else:
            baris.nilai = str(isi)


def pemakaian_hashtag(db: Session) -> dict[str, datetime]:
    """Hashtag yang di-query dalam 7 hari terakhir -> kapan slotnya bebas lagi."""
    batas = sekarang() - timedelta(days=JENDELA_HASHTAG_HARI)
    baris = db.execute(
        select(PemakaianHashtag.hashtag, func.max(PemakaianHashtag.waktu))
        .where(PemakaianHashtag.waktu >= batas)
        .group_by(PemakaianHashtag.hashtag)
    ).all()
    return {nama: terakhir + timedelta(days=JENDELA_HASHTAG_HARI) for nama, terakhir in baris}


def catat_pemakaian_hashtag(db: Session, nama: str) -> None:
    db.add(PemakaianHashtag(hashtag=nama))


# ---------------------------------------------------------------------------
# Gambar
# ---------------------------------------------------------------------------


def deteksi_ekstensi(data: bytes) -> str | None:
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return ".png"
    if data.startswith(b"\xff\xd8\xff"):
        return ".jpg"
    if data[:6] in (b"GIF87a", b"GIF89a"):
        return ".gif"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return ".webp"
    return None


def sha256_hex(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _tulis_gambar(data: bytes, hash_hex: str) -> str:
    ext = deteksi_ekstensi(data)
    subfolder = sekarang().strftime("%Y-%m")
    tujuan = config.MEDIA_DIR / subfolder / f"{hash_hex[:20]}{ext}"
    tujuan.parent.mkdir(parents=True, exist_ok=True)
    if not tujuan.exists():
        tujuan.write_bytes(data)
    return f"{subfolder}/{tujuan.name}"


def path_gambar_absolut(post: Postingan) -> Path | None:
    if not post.path_gambar:
        return None
    return config.MEDIA_DIR / post.path_gambar


def periksa_gambar(data: bytes) -> None:
    if len(data) > MAKS_UKURAN_GAMBAR:
        raise ValueError(f"Gambar terlalu besar (maks. {MAKS_UKURAN_GAMBAR // 1024 // 1024} MB).")
    if deteksi_ekstensi(data) is None:
        raise ValueError("Format gambar tidak dikenali. Gunakan JPG, PNG, WEBP, atau GIF.")


# ---------------------------------------------------------------------------
# Postingan
# ---------------------------------------------------------------------------


@dataclass
class HasilTambah:
    postingan: Postingan | None
    duplikat: Postingan | None = None
    dikecualikan: str | None = None


def cari_duplikat(db: Session, permalink: str | None, hash_konten: str | None) -> Postingan | None:
    if permalink:
        ada = db.scalar(select(Postingan).where(Postingan.permalink == permalink))
        if ada:
            return ada
    if hash_konten:
        return db.scalar(select(Postingan).where(Postingan.hash_konten == hash_konten).limit(1))
    return None


def permalink_sudah_ada(db: Session, permalink: str) -> bool:
    try:
        link = normalisasi.permalink(permalink)
    except ValueError:
        return False
    return db.scalar(select(Postingan.id).where(Postingan.permalink == link)) is not None


def cocok_pengecualian(db: Session, teks: str | None) -> str | None:
    if not teks:
        return None
    for kata in db.scalars(select(KataPengecualian.kata)):
        if re.search(rf"(?<!\w){re.escape(kata)}(?!\w)", teks, re.IGNORECASE):
            return kata
    return None


def tambah_postingan(
    db: Session,
    *,
    sumber: str,
    permalink: str | None = None,
    caption: str | None = None,
    akun_ig: str | None = None,
    gambar: bytes | None = None,
    tanggal_posting: datetime | None = None,
    sumber_ref: str | None = None,
    ig_media_id: str | None = None,
    contoh: bool = False,
    cek_pengecualian: bool = False,
) -> HasilTambah:
    """Simpan postingan baru berstatus 'belum_diproses', kecuali duplikat.

    Duplikat dikenali dari permalink yang sama, gambar yang identik, atau (untuk
    postingan tanpa link dan tanpa gambar) caption yang identik.
    """
    if sumber not in SUMBER:
        raise ValueError(f"Sumber tidak dikenal: {sumber}")
    caption = (caption or "").strip() or None
    permalink = normalisasi.permalink(permalink)
    akun_ig = normalisasi.username(akun_ig)
    if gambar is not None:
        periksa_gambar(gambar)
    if not (permalink or caption or gambar):
        raise ValueError("Isi minimal salah satu: link postingan, caption, atau gambar poster.")

    if gambar is not None:
        hash_konten = sha256_hex(gambar)
    elif not permalink and caption:
        hash_konten = sha256_hex(" ".join(caption.lower().split()).encode())
    else:
        hash_konten = None

    duplikat = cari_duplikat(db, permalink, hash_konten)
    if duplikat:
        return HasilTambah(None, duplikat=duplikat)

    post = Postingan(
        sumber=sumber,
        sumber_ref=sumber_ref,
        permalink=permalink,
        ig_media_id=ig_media_id,
        hash_konten=hash_konten,
        akun_ig=akun_ig,
        caption=caption,
        path_gambar=_tulis_gambar(gambar, hash_konten) if gambar is not None else None,
        tanggal_posting=tanggal_posting,
        contoh=contoh,
        status="belum_diproses",
    )
    db.add(post)
    db.flush()
    _catat_riwayat(db, post, None, "belum_diproses", f"Masuk dari {SUMBER[sumber].lower()}")

    if cek_pengecualian:
        kata = cocok_pengecualian(db, caption)
        if kata:
            post.relevan = False
            post.skor = 1
            post.alasan = f'Otomatis: caption mengandung kata pengecualian "{kata}".'
            ubah_status(db, post, "tidak_relevan", f'Kata pengecualian "{kata}"')
            return HasilTambah(post, dikecualikan=kata)
    return HasilTambah(post)


def _catat_riwayat(db: Session, post: Postingan, dari: str | None, ke: str, keterangan: str | None) -> None:
    db.add(RiwayatStatus(postingan_id=post.id, dari=dari, ke=ke, keterangan=keterangan))


def ubah_status(db: Session, post: Postingan, status_baru: str, keterangan: str | None = None) -> bool:
    """Ganti status dan catat riwayatnya. Mengembalikan False jika status tidak berubah."""
    if status_baru not in STATUS:
        raise ValueError(f"Status tidak dikenal: {status_baru!r}. Pilihan: {', '.join(STATUS)}")
    lama = post.status
    if lama == status_baru:
        return False
    post.status = status_baru
    if status_baru in STATUS_DIHUBUNGI:
        post.terakhir_dihubungi = hari_ini()
    _catat_riwayat(db, post, lama, status_baru, keterangan)
    return True


def simpan_hasil_analisis(
    db: Session, post: Postingan, hasil: dict, ambang: int, timpa: bool = False
) -> str:
    """Simpan hasil /radar yang sudah divalidasi, lalu tentukan status.

    Skor >= ambang dan relevan -> 'baru', selain itu -> 'tidak_relevan'. Status
    follow-up (Sudah DM, Nego, dst.) tidak diubah saat analisis ditimpa.
    """
    if post.status != "belum_diproses" and not timpa:
        raise ValueError(
            f"Postingan #{post.id} sudah dianalisis (status: {STATUS[post.status]}). "
            "Tambahkan --timpa jika memang ingin menimpa hasilnya."
        )
    for kolom, nilai in hasil.items():
        setattr(post, kolom, nilai)
    post.dianalisis_pada = sekarang()
    target = "baru" if hasil["relevan"] and hasil["skor"] >= ambang else "tidak_relevan"
    if post.status in ("belum_diproses", "baru", "tidak_relevan"):
        ubah_status(db, post, target, f"Hasil /radar (skor {hasil['skor']})")
    return post.status


def hapus_postingan(db: Session, post: Postingan) -> None:
    path = path_gambar_absolut(post)
    dipakai_lain = post.path_gambar and db.scalar(
        select(func.count(Postingan.id)).where(
            Postingan.path_gambar == post.path_gambar, Postingan.id != post.id
        )
    )
    db.delete(post)
    if path and not dipakai_lain and path.exists():
        path.unlink()


def ambil_pending(db: Session, limit: int) -> list[Postingan]:
    return list(
        db.scalars(
            select(Postingan)
            .where(Postingan.status == "belum_diproses")
            .order_by(Postingan.dikumpulkan_pada, Postingan.id)
            .limit(limit)
        )
    )


def hitung_status(db: Session) -> dict[str, int]:
    baris = db.execute(select(Postingan.status, func.count()).group_by(Postingan.status)).all()
    hasil = {s: 0 for s in STATUS}
    hasil.update({s: n for s, n in baris})
    return hasil


# ---------------------------------------------------------------------------
# Urutan & ringkasan
# ---------------------------------------------------------------------------


def kunci_urut_tanggal(post: Postingan, acuan: date | None = None) -> tuple:
    """Acara terdekat yang belum lewat dulu, lalu tanpa tanggal, lalu yang sudah lewat."""
    acuan = acuan or hari_ini()
    skor = -(post.skor or 0)
    t = post.tanggal_acara
    if t is not None and t >= acuan:
        return (0, t.toordinal(), skor)
    if t is None:
        return (1, 0, skor)
    return (2, -t.toordinal(), skor)


def prospek_teratas(db: Session, n: int = 5) -> list[Postingan]:
    """Prospek aktif dengan acara terdekat yang belum lewat (lalu yang tanpa tanggal)."""
    kandidat = db.scalars(select(Postingan).where(Postingan.status.in_(STATUS_AKTIF))).all()
    acuan = hari_ini()
    kandidat = [p for p in kandidat if p.tanggal_acara is None or p.tanggal_acara >= acuan]
    return sorted(kandidat, key=lambda p: kunci_urut_tanggal(p, acuan))[:n]


def statistik(db: Session) -> dict:
    pengaturan = ambil_pengaturan(db)
    per_status = hitung_status(db)
    acuan = hari_ini()
    acara_7_hari = db.scalar(
        select(func.count(Postingan.id)).where(
            Postingan.status.in_(STATUS_AKTIF),
            Postingan.tanggal_acara >= acuan,
            Postingan.tanggal_acara <= acuan + timedelta(days=7),
        )
    )
    prospek_bagus = db.scalar(
        select(func.count(Postingan.id)).where(
            Postingan.relevan.is_(True), Postingan.skor >= pengaturan["ambang_skor"]
        )
    )
    return {
        "hari_ini": acuan.isoformat(),
        "total": sum(per_status.values()),
        "per_status": per_status,
        "menunggu_analisis": per_status["belum_diproses"],
        "prospek_aktif": sum(per_status[s] for s in STATUS_AKTIF),
        "prospek_bagus": prospek_bagus,
        "acara_7_hari_ke_depan": acara_7_hari,
        "ambang_skor": pengaturan["ambang_skor"],
        "hari_mendesak": pengaturan["hari_mendesak"],
        "teratas": [ringkas_prospek(p) for p in prospek_teratas(db)],
    }


def ringkas_prospek(post: Postingan) -> dict:
    return {
        "id": post.id,
        "nama_acara": post.judul,
        "jenis_acara": post.jenis_acara,
        "tanggal_acara": post.tanggal_acara.isoformat() if post.tanggal_acara else None,
        "sisa_hari": post.sisa_hari,
        "lokasi": post.lokasi,
        "kota": post.kota,
        "skor": post.skor,
        "status": post.status,
        "kontak_ig": post.kontak_ig,
        "kontak_wa": post.kontak_wa,
    }

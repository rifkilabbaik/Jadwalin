"""Skema database (SQLAlchemy 2.0)."""

from __future__ import annotations

from datetime import date, datetime

from sqlalchemy import Date, ForeignKey, String, Text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

from .config import hari_ini, sekarang


class Base(DeclarativeBase):
    pass


class Postingan(Base):
    """Satu postingan Instagram (atau screenshot poster) beserta hasil analisis dan follow-up."""

    __tablename__ = "postingan"

    id: Mapped[int] = mapped_column(primary_key=True)
    sumber: Mapped[str] = mapped_column(String(20))
    # Hashtag atau username asal postingan, untuk collector Graph API.
    sumber_ref: Mapped[str | None] = mapped_column(String(100))
    permalink: Mapped[str | None] = mapped_column(String(500), unique=True)
    ig_media_id: Mapped[str | None] = mapped_column(String(50))
    # sha256 gambar (atau caption, jika tanpa gambar dan tanpa link) untuk cegah duplikat.
    hash_konten: Mapped[str | None] = mapped_column(String(64), index=True)
    akun_ig: Mapped[str | None] = mapped_column(String(100))
    caption: Mapped[str | None] = mapped_column(Text)
    # Relatif terhadap folder media/, mis. "2026-09/ab12cd34.jpg".
    path_gambar: Mapped[str | None] = mapped_column(String(300))
    tanggal_posting: Mapped[datetime | None]
    dikumpulkan_pada: Mapped[datetime] = mapped_column(default=sekarang)
    contoh: Mapped[bool] = mapped_column(default=False)
    status: Mapped[str] = mapped_column(String(20), default="belum_diproses", index=True)

    # Hasil analisis dari /radar
    relevan: Mapped[bool | None]
    skor: Mapped[int | None] = mapped_column(index=True)
    jenis_acara: Mapped[str | None] = mapped_column(String(30))
    alasan: Mapped[str | None] = mapped_column(Text)
    nama_acara: Mapped[str | None] = mapped_column(String(200))
    penyelenggara: Mapped[str | None] = mapped_column(String(200))
    tanggal_acara: Mapped[date | None] = mapped_column(Date, index=True)
    lokasi: Mapped[str | None] = mapped_column(String(300))
    kota: Mapped[str | None] = mapped_column(String(20))
    perkiraan_peserta: Mapped[int | None]
    kontak_ig: Mapped[str | None] = mapped_column(String(100))
    kontak_wa: Mapped[str | None] = mapped_column(String(20))
    catatan_ai: Mapped[str | None] = mapped_column(Text)
    draf_dm: Mapped[str | None] = mapped_column(Text)
    dianalisis_pada: Mapped[datetime | None]

    # Follow-up oleh pemilik usaha
    catatan: Mapped[str | None] = mapped_column(Text)
    terakhir_dihubungi: Mapped[date | None] = mapped_column(Date)
    diperbarui_pada: Mapped[datetime] = mapped_column(default=sekarang, onupdate=sekarang)

    riwayat: Mapped[list[RiwayatStatus]] = relationship(
        back_populates="postingan",
        cascade="all, delete-orphan",
        order_by="RiwayatStatus.waktu",
    )

    @property
    def judul(self) -> str:
        if self.nama_acara:
            return self.nama_acara
        if self.caption:
            baris = self.caption.strip().splitlines()[0]
            return baris[:80] + ("…" if len(baris) > 80 else "")
        return f"Postingan #{self.id}"

    @property
    def sisa_hari(self) -> int | None:
        if self.tanggal_acara is None:
            return None
        return (self.tanggal_acara - hari_ini()).days


class RiwayatStatus(Base):
    __tablename__ = "riwayat_status"

    id: Mapped[int] = mapped_column(primary_key=True)
    postingan_id: Mapped[int] = mapped_column(
        ForeignKey("postingan.id", ondelete="CASCADE"), index=True
    )
    dari: Mapped[str | None] = mapped_column(String(20))
    ke: Mapped[str] = mapped_column(String(20), index=True)
    waktu: Mapped[datetime] = mapped_column(default=sekarang, index=True)
    keterangan: Mapped[str | None] = mapped_column(String(300))

    postingan: Mapped[Postingan] = relationship(back_populates="riwayat")


class Hashtag(Base):
    __tablename__ = "hashtag"

    id: Mapped[int] = mapped_column(primary_key=True)
    nama: Mapped[str] = mapped_column(String(100), unique=True)
    aktif: Mapped[bool] = mapped_column(default=True)
    ig_hashtag_id: Mapped[str | None] = mapped_column(String(50))
    terakhir_dicek: Mapped[datetime | None]
    pesan_terakhir: Mapped[str | None] = mapped_column(String(300))
    dibuat_pada: Mapped[datetime] = mapped_column(default=sekarang)


class AkunPantauan(Base):
    __tablename__ = "akun_pantauan"

    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(String(100), unique=True)
    aktif: Mapped[bool] = mapped_column(default=True)
    terakhir_dicek: Mapped[datetime | None]
    pesan_terakhir: Mapped[str | None] = mapped_column(String(300))
    dibuat_pada: Mapped[datetime] = mapped_column(default=sekarang)


class KataPengecualian(Base):
    __tablename__ = "kata_pengecualian"

    id: Mapped[int] = mapped_column(primary_key=True)
    kata: Mapped[str] = mapped_column(String(100), unique=True)
    dibuat_pada: Mapped[datetime] = mapped_column(default=sekarang)


class PemakaianHashtag(Base):
    """Catatan tiap kali sebuah hashtag di-query ke Graph API (untuk batas 30 unik / 7 hari)."""

    __tablename__ = "pemakaian_hashtag"

    id: Mapped[int] = mapped_column(primary_key=True)
    hashtag: Mapped[str] = mapped_column(String(100), index=True)
    waktu: Mapped[datetime] = mapped_column(default=sekarang, index=True)


class Pengaturan(Base):
    __tablename__ = "pengaturan"

    kunci: Mapped[str] = mapped_column(String(50), primary_key=True)
    nilai: Mapped[str] = mapped_column(String(500))

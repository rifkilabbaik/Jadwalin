"""Interface bersama semua collector."""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field

from sqlalchemy.orm import Session

from ..layanan import HasilTambah


@dataclass
class HasilCollect:
    nama: str
    label: str
    aktif: bool
    keterangan: str = ""
    baru: int = 0
    duplikat: int = 0
    dikecualikan: int = 0
    galat: list[str] = field(default_factory=list)

    def catat(self, hasil: HasilTambah) -> None:
        if hasil.duplikat is not None:
            self.duplikat += 1
        elif hasil.dikecualikan:
            self.dikecualikan += 1
        else:
            self.baru += 1

    def ringkas(self) -> str:
        if not self.aktif:
            return f"nonaktif ({self.keterangan})"
        teks = f"{self.baru} baru, {self.duplikat} duplikat, {self.dikecualikan} dikecualikan"
        if self.galat:
            teks += f", {len(self.galat)} galat"
        return teks


class Collector(ABC):
    """Sumber postingan. Tiap collector menyimpan lewat layanan.tambah_postingan()."""

    nama: str
    label: str

    @abstractmethod
    def cek_aktif(self, db: Session) -> tuple[bool, str]:
        """(aktif?, keterangan singkat untuk ditampilkan)."""

    @abstractmethod
    def collect(self, db: Session, hasil: HasilCollect) -> None:
        """Ambil postingan baru. Commit per item agar galat di tengah tidak menghapus hasil sebelumnya."""

    def jalankan(self, db: Session) -> HasilCollect:
        aktif, keterangan = self.cek_aktif(db)
        hasil = HasilCollect(self.nama, self.label, aktif, keterangan)
        if not aktif:
            return hasil
        try:
            self.collect(db, hasil)
        except Exception as e:  # satu collector gagal tidak boleh menghentikan yang lain
            db.rollback()
            hasil.galat.append(f"{type(e).__name__}: {e}")
        return hasil

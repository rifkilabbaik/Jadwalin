"""Collector folder inbox/: screenshot poster (dan catatan .txt pendamping)."""

from __future__ import annotations

import re
import shutil
from pathlib import Path

from sqlalchemy.orm import Session

from .. import config, layanan
from ..konstanta import EKSTENSI_GAMBAR
from .base import Collector, HasilCollect

AWALAN_CONTOH = "contoh_"
_RE_URL = re.compile(r"^https?://\S+$|^(www\.)?instagram\.com/\S+$", re.I)
_RE_AKUN = re.compile(r"^@[A-Za-z0-9._]{1,30}$")


def baca_teks_pendamping(teks: str) -> tuple[str | None, str | None, str | None]:
    """Pisahkan isi .txt menjadi (link, akun, caption).

    Baris yang hanya berisi URL dianggap link postingan, baris yang hanya berisi
    @username dianggap akun, sisanya caption.
    """
    link = akun = None
    sisa = []
    for baris in teks.splitlines():
        b = baris.strip()
        if link is None and _RE_URL.match(b):
            link = b
        elif akun is None and _RE_AKUN.match(b):
            akun = b
        else:
            sisa.append(baris)
    caption = "\n".join(sisa).strip() or None
    return link, akun, caption


class InboxCollector(Collector):
    nama = "inbox"
    label = "Folder inbox"

    def _folder(self) -> Path:
        config.INBOX_DIR.mkdir(parents=True, exist_ok=True)
        return config.INBOX_DIR

    def _berkas(self) -> dict[str, dict]:
        """Kelompokkan berkas berdasarkan nama tanpa ekstensi: {nama: {gambar: [...], teks: path}}."""
        grup: dict[str, dict] = {}
        for path in sorted(self._folder().iterdir()):
            if not path.is_file() or path.name.startswith((".", "_")):
                continue
            ext = path.suffix.lower()
            if ext in EKSTENSI_GAMBAR:
                grup.setdefault(path.stem, {"gambar": [], "teks": None})["gambar"].append(path)
            elif ext == ".txt":
                grup.setdefault(path.stem, {"gambar": [], "teks": None})["teks"] = path
        return grup

    def cek_aktif(self, db: Session) -> tuple[bool, str]:
        n = len(self._berkas())
        return True, f"{n} item menunggu di {self._folder()}"

    def _pindahkan(self, path: Path, subfolder: str) -> None:
        tujuan = self._folder() / subfolder
        tujuan.mkdir(exist_ok=True)
        target = tujuan / path.name
        n = 1
        while target.exists():
            target = tujuan / f"{path.stem}-{n}{path.suffix}"
            n += 1
        shutil.move(str(path), target)

    def collect(self, db: Session, hasil: HasilCollect) -> None:
        for nama, grup in self._berkas().items():
            link = akun = caption = None
            if grup["teks"]:
                link, akun, caption = baca_teks_pendamping(grup["teks"].read_text(encoding="utf-8", errors="replace"))
            sumber_gambar = grup["gambar"] or [None]
            semua_ok = True
            for path_gambar in sumber_gambar:
                try:
                    h = layanan.tambah_postingan(
                        db,
                        sumber="inbox",
                        permalink=link,
                        caption=caption,
                        akun_ig=akun,
                        gambar=path_gambar.read_bytes() if path_gambar else None,
                        contoh=nama.startswith(AWALAN_CONTOH),
                        cek_pengecualian=True,
                    )
                    db.commit()
                except ValueError as e:
                    db.rollback()
                    semua_ok = False
                    hasil.galat.append(f"{(path_gambar or grup['teks']).name}: {e}")
                    if path_gambar:
                        self._pindahkan(path_gambar, "_gagal")
                    continue
                hasil.catat(h)
                if path_gambar:
                    self._pindahkan(path_gambar, "_duplikat" if h.duplikat else "_selesai")
            if grup["teks"]:
                self._pindahkan(grup["teks"], "_selesai" if semua_ok else "_gagal")

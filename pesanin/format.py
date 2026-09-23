"""Format tanggal dan angka dalam bahasa Indonesia."""

from __future__ import annotations

from datetime import date, datetime

HARI = ("Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu")
BULAN = (
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember",
)


def tanggal_panjang(d: date | None) -> str:
    """Sabtu, 10 Oktober 2026"""
    if d is None:
        return "-"
    return f"{HARI[d.weekday()]}, {d.day} {BULAN[d.month - 1]} {d.year}"


def tanggal_pendek(d: date | datetime | None) -> str:
    """Sab, 10 Okt 2026"""
    if d is None:
        return "-"
    return f"{HARI[d.weekday()][:3]}, {d.day} {BULAN[d.month - 1][:3]} {d.year}"


def waktu(d: datetime | None) -> str:
    if d is None:
        return "-"
    return f"{d.day} {BULAN[d.month - 1][:3]} {d.year} {d:%H:%M}"


def label_sisa_hari(sisa: int | None) -> str:
    if sisa is None:
        return "Tanggal belum diketahui"
    if sisa == 0:
        return "Hari ini"
    if sisa == 1:
        return "Besok"
    if sisa > 1:
        return f"H-{sisa}"
    return f"Lewat {-sisa} hari"


def rupiah(n: int) -> str:
    return "Rp" + f"{n:,}".replace(",", ".")

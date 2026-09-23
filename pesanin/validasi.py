"""Validasi ketat JSON hasil analisis /radar sebelum disimpan."""

from __future__ import annotations

import json
import re
from datetime import date, datetime, timedelta

from . import normalisasi
from .config import hari_ini
from .konstanta import JENIS_ACARA, JENIS_BUKAN_PROSPEK, KOTA

KOLOM_DASAR = ("relevan", "skor", "jenis_acara", "alasan")
KOLOM_EKSTRAKSI = (
    "nama_acara",
    "penyelenggara",
    "tanggal_acara",
    "lokasi",
    "kota",
    "perkiraan_peserta",
    "kontak_ig",
    "kontak_wa",
    "catatan",
)
SEMUA_KOLOM = KOLOM_DASAR + KOLOM_EKSTRAKSI + ("draf_dm",)

PANJANG_MAKS = {
    "alasan": 500,
    "nama_acara": 200,
    "penyelenggara": 200,
    "lokasi": 300,
    "catatan": 1000,
    "draf_dm": 1500,
}
PANJANG_MIN_DM = 40

# Isian yang seharusnya ditulis null.
_KOSONG_SAMARAN = {"-", "--", "n/a", "na", "null", "none", "tidak ada", "tidak diketahui", "belum diketahui", "?"}


class HasilTidakValid(Exception):
    def __init__(self, kesalahan: list[str]):
        super().__init__("\n".join(kesalahan))
        self.kesalahan = kesalahan


def baca_json(teks: str) -> object:
    try:
        return json.loads(teks)
    except json.JSONDecodeError as e:
        awal = max(e.pos - 40, 0)
        potongan = teks[awal : e.pos + 40].replace("\n", "\\n")
        raise HasilTidakValid(
            [
                f"JSON tidak bisa dibaca: {e.msg} (baris {e.lineno}, kolom {e.colno}).",
                f"Sekitar: ...{potongan}...",
                "Periksa tanda kutip ganda, koma berlebih, dan gunakan true/false/null (huruf kecil).",
            ]
        ) from None


def _jenis(nilai: object) -> str:
    if nilai is None:
        return "null"
    if isinstance(nilai, bool):
        return "boolean"
    if isinstance(nilai, int):
        return "angka bulat"
    if isinstance(nilai, float):
        return "angka desimal"
    if isinstance(nilai, str):
        return "teks"
    if isinstance(nilai, list):
        return "list"
    return "objek"


def validasi_hasil(data: object, ambang: int) -> tuple[dict, list[str]]:
    """Kembalikan (kolom siap simpan, peringatan). Lempar HasilTidakValid jika ada kesalahan.

    Kunci 'catatan' disimpan sebagai kolom 'catatan_ai' agar tidak tertukar
    dengan catatan follow-up milik pemilik usaha.
    """
    if not isinstance(data, dict):
        raise HasilTidakValid([f"Hasil harus berupa objek JSON {{...}}, bukan {_jenis(data)}."])

    salah: list[str] = []
    peringatan: list[str] = []
    bersih: dict = {}

    tak_dikenal = sorted(set(data) - set(SEMUA_KOLOM))
    if tak_dikenal:
        salah.append(
            f"Kolom tidak dikenal: {', '.join(tak_dikenal)}. Kolom yang diizinkan: {', '.join(SEMUA_KOLOM)}."
        )

    for kolom in KOLOM_DASAR:
        if kolom not in data:
            salah.append(f"{kolom}: wajib ada.")

    # --- kolom dasar ---
    relevan = data.get("relevan")
    if "relevan" in data:
        if isinstance(relevan, bool):
            bersih["relevan"] = relevan
        else:
            salah.append(f"relevan: harus true atau false tanpa tanda kutip, diterima {_jenis(relevan)} {relevan!r}.")

    skor = data.get("skor")
    if "skor" in data:
        if type(skor) is int and 1 <= skor <= 10:
            bersih["skor"] = skor
        else:
            salah.append(f"skor: harus angka bulat 1-10 tanpa tanda kutip, diterima {_jenis(skor)} {skor!r}.")

    jenis = data.get("jenis_acara")
    if "jenis_acara" in data:
        if isinstance(jenis, str) and jenis in JENIS_ACARA:
            bersih["jenis_acara"] = jenis
        else:
            salah.append(f"jenis_acara: {jenis!r} tidak dikenal. Pilihan: {', '.join(JENIS_ACARA)}.")

    if "alasan" in data:
        alasan = _teks(data["alasan"], "alasan", salah, wajib=True)
        if alasan is not None:
            bersih["alasan"] = alasan

    # --- aturan konsistensi ---
    skor_ok = "skor" in bersih
    prospek = skor_ok and bersih["skor"] >= ambang
    if skor_ok and "relevan" in bersih and prospek and not bersih["relevan"]:
        salah.append(f"relevan=false tetapi skor {skor} >= ambang {ambang}. Turunkan skor atau set relevan=true.")
    if "jenis_acara" in bersih and bersih["jenis_acara"] in JENIS_BUKAN_PROSPEK:
        if bersih.get("relevan"):
            salah.append(f"jenis_acara {jenis!r} tidak boleh relevan=true.")
        if prospek:
            salah.append(f"jenis_acara {jenis!r} harus diberi skor di bawah ambang ({ambang}).")

    # --- kolom ekstraksi ---
    if prospek:
        hilang = [k for k in KOLOM_EKSTRAKSI + ("draf_dm",) if k not in data]
        if hilang:
            salah.append(
                f"Skor {skor} >= ambang {ambang}, jadi kolom berikut wajib ada (isi null jika tidak diketahui): "
                f"{', '.join(hilang)}."
            )

    bersih["nama_acara"] = _teks(data.get("nama_acara"), "nama_acara", salah, wajib=prospek and "nama_acara" in data)
    bersih["penyelenggara"] = _teks(data.get("penyelenggara"), "penyelenggara", salah)
    bersih["lokasi"] = _teks(data.get("lokasi"), "lokasi", salah)
    bersih["catatan_ai"] = _teks(data.get("catatan"), "catatan", salah)
    bersih["tanggal_acara"] = _tanggal(data.get("tanggal_acara"), salah, peringatan, prospek)
    bersih["perkiraan_peserta"] = _peserta(data.get("perkiraan_peserta"), salah)

    kota = data.get("kota")
    if kota is None:
        bersih["kota"] = None
    elif isinstance(kota, str) and kota in KOTA:
        bersih["kota"] = kota
    else:
        salah.append(f"kota: {kota!r} tidak dikenal. Pilihan: {', '.join(KOTA)}, atau null.")

    bersih["kontak_ig"] = _normal(data.get("kontak_ig"), "kontak_ig", normalisasi.username, salah)
    bersih["kontak_wa"] = _normal(data.get("kontak_wa"), "kontak_wa", normalisasi.nomor_wa, salah)

    # --- draf DM ---
    draf = _teks(data.get("draf_dm"), "draf_dm", salah, wajib=prospek and "draf_dm" in data)
    if draf is not None:
        if len(draf) < PANJANG_MIN_DM:
            salah.append(f"draf_dm: terlalu pendek ({len(draf)} karakter, minimal {PANJANG_MIN_DM}).")
        sisa_template = re.findall(r"\{[^{}]*\}", draf)
        if sisa_template:
            salah.append(f"draf_dm: masih ada placeholder template yang belum diisi: {', '.join(sisa_template)}.")
        nama = bersih.get("nama_acara")
        if nama and nama.lower() not in draf.lower():
            peringatan.append(f"draf_dm tidak menyebut nama acara persis ({nama!r}). Pastikan nama acaranya disebut.")
    bersih["draf_dm"] = draf

    if salah:
        raise HasilTidakValid(salah)
    return bersih, peringatan


def _teks(nilai: object, kolom: str, salah: list[str], wajib: bool = False) -> str | None:
    if nilai is None:
        if wajib:
            salah.append(f"{kolom}: wajib diisi teks, tidak boleh null.")
        return None
    if not isinstance(nilai, str):
        salah.append(f"{kolom}: harus teks atau null, diterima {_jenis(nilai)} {nilai!r}.")
        return None
    teks = nilai.strip()
    if not teks:
        if wajib:
            salah.append(f"{kolom}: wajib diisi, tidak boleh kosong.")
        else:
            salah.append(f"{kolom}: jangan isi string kosong. Pakai null jika tidak diketahui.")
        return None
    if teks.lower() in _KOSONG_SAMARAN:
        salah.append(f"{kolom}: {nilai!r} berarti tidak diketahui. Tulis null (tanpa tanda kutip).")
        return None
    maks = PANJANG_MAKS.get(kolom)
    if maks and len(teks) > maks:
        salah.append(f"{kolom}: terlalu panjang ({len(teks)} karakter, maks. {maks}).")
        return None
    return teks


def _tanggal(nilai: object, salah: list[str], peringatan: list[str], prospek: bool) -> date | None:
    if nilai is None:
        return None
    if not isinstance(nilai, str):
        salah.append(f"tanggal_acara: harus teks ISO 'YYYY-MM-DD' atau null, diterima {_jenis(nilai)} {nilai!r}.")
        return None
    teks = nilai.strip()
    try:
        if re.fullmatch(r"\d{4}-\d{2}-\d{2}", teks):
            tgl = date.fromisoformat(teks)
        elif re.fullmatch(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?([+-]\d{2}:\d{2}|Z)?", teks):
            tgl = datetime.fromisoformat(teks.replace("Z", "+00:00")).date()
        else:
            raise ValueError
    except ValueError:
        salah.append(f"tanggal_acara: {nilai!r} bukan tanggal ISO yang valid. Contoh: '2026-10-17'.")
        return None
    acuan = hari_ini()
    if tgl.year < 2020 or tgl > acuan + timedelta(days=730):
        salah.append(f"tanggal_acara: {tgl.isoformat()} tidak masuk akal. Periksa tahunnya.")
        return None
    if prospek and tgl < acuan:
        peringatan.append(
            f"tanggal_acara {tgl.isoformat()} sudah lewat, tapi skornya tinggi. Yakin acaranya belum selesai?"
        )
    return tgl


def _peserta(nilai: object, salah: list[str]) -> int | None:
    if nilai is None:
        return None
    if type(nilai) is int and 1 <= nilai <= 100_000:
        return nilai
    salah.append(
        f"perkiraan_peserta: harus angka bulat 1-100000 tanpa tanda kutip atau null, diterima {_jenis(nilai)} {nilai!r}. "
        "Untuk rentang ('100-150'), tulis angka tengahnya."
    )
    return None


def _normal(nilai: object, kolom: str, fungsi, salah: list[str]) -> str | None:
    if nilai is None:
        return None
    if not isinstance(nilai, str):
        salah.append(f"{kolom}: harus teks atau null, diterima {_jenis(nilai)} {nilai!r}.")
        return None
    try:
        return fungsi(nilai)
    except ValueError as e:
        salah.append(f"{kolom}: {e}")
        return None


def contoh_hasil() -> dict:
    """Template JSON yang ditampilkan oleh `manage.py skema`."""
    return {
        "relevan": True,
        "skor": 8,
        "jenis_acara": "seminar",
        "alasan": "Seminar kampus 300 peserta di Bandung, ada sesi makan siang.",
        "nama_acara": "Seminar Nasional Digitalpreneur 2026",
        "penyelenggara": "HIMA Manajemen STIE Cendana",
        "tanggal_acara": "2026-10-10",
        "lokasi": "Aula STIE Cendana, Jl. Contoh No. 1, Bandung",
        "kota": "bandung",
        "perkiraan_peserta": 300,
        "kontak_ig": "hima.contoh",
        "kontak_wa": "081234567890",
        "catatan": "Panitia menyebut 'free lunch'. Belum terlihat sponsor catering.",
        "draf_dm": "Halo Kak panitia Seminar Nasional Digitalpreneur 2026! ...",
    }

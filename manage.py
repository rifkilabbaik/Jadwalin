#!/usr/bin/env python
"""CLI Pesanin. Jalankan `python manage.py --help` untuk daftar perintah."""

from __future__ import annotations

import argparse
import json
import shutil
import sys
from datetime import datetime
from pathlib import Path

from sqlalchemy import select

from pesanin import config, layanan
from pesanin.collectors import jalankan_semua, semua_collector
from pesanin.db import inisialisasi, sesi
from pesanin.format import label_sisa_hari, tanggal_pendek
from pesanin.konstanta import JENIS_ACARA, KOTA, STATUS
from pesanin.models import Postingan
from pesanin.validasi import SEMUA_KOLOM, HasilTidakValid, baca_json, contoh_hasil, validasi_hasil

FOLDER_CONTOH = config.BASE_DIR / "contoh"


def _utf8() -> None:
    # Di Windows, output yang di-pipe memakai cp1252 dan gagal mencetak emoji di caption.
    for aliran in (sys.stdout, sys.stderr, sys.stdin):
        try:
            aliran.reconfigure(encoding="utf-8")
        except (AttributeError, ValueError):
            pass


def _galat(pesan: str) -> None:
    print(pesan, file=sys.stderr)


# ---------------------------------------------------------------------------


def cmd_collect(args) -> int:
    with sesi() as db:
        hasil = jalankan_semua(db, hanya=args.hanya)
        menunggu = layanan.hitung_status(db)["belum_diproses"]
    for h in hasil:
        print(f"[{h.nama:<10}] {h.ringkas()}")
        for g in h.galat:
            print(f"    GALAT: {g}")
    print(f"Postingan menunggu analisis: {menunggu}")
    return 0


def cmd_pending(args) -> int:
    if not 1 <= args.limit <= 200:
        _galat("--limit harus di antara 1 dan 200.")
        return 2
    with sesi() as db:
        posts = layanan.ambil_pending(db, args.limit)
        total = layanan.hitung_status(db)["belum_diproses"]
        pengaturan = layanan.ambil_pengaturan(db)
        keluaran = {
            "hari_ini": config.hari_ini().isoformat(),
            "ambang_skor": pengaturan["ambang_skor"],
            "hari_mendesak": pengaturan["hari_mendesak"],
            "jumlah": len(posts),
            "sisa_setelah_ini": total - len(posts),
            "postingan": [
                {
                    "id": p.id,
                    "sumber": p.sumber,
                    "permalink": p.permalink,
                    "akun_ig": p.akun_ig,
                    "tanggal_posting": p.tanggal_posting.isoformat(timespec="minutes") if p.tanggal_posting else None,
                    "caption": p.caption,
                    "path_gambar": str(layanan.path_gambar_absolut(p)) if p.path_gambar else None,
                }
                for p in posts
            ],
        }
    print(json.dumps(keluaran, ensure_ascii=False, indent=2))
    return 0


def _baca_masukan_hasil(args) -> str:
    if args.file:
        return Path(args.file).read_text(encoding="utf-8")
    if args.json == "-":
        return sys.stdin.read()
    return args.json


def cmd_save_result(args) -> int:
    try:
        teks = _baca_masukan_hasil(args)
    except OSError as e:
        _galat(f"GAGAL membaca file hasil: {e}")
        return 2
    try:
        data = baca_json(teks)
        with sesi() as db:
            post = db.get(Postingan, args.id)
            if post is None:
                _galat(f"GAGAL: postingan #{args.id} tidak ditemukan. Cek id dari `python manage.py pending`.")
                return 2
            ambang = layanan.ambil_pengaturan(db)["ambang_skor"]
            bersih, peringatan = validasi_hasil(data, ambang)
            status = layanan.simpan_hasil_analisis(db, post, bersih, ambang, timpa=args.timpa)
    except HasilTidakValid as e:
        _galat(f"GAGAL: hasil untuk postingan #{args.id} tidak valid, belum disimpan:")
        for k in e.kesalahan:
            _galat(f"  - {k}")
        _galat("Perbaiki JSON-nya lalu jalankan save-result lagi. Lihat `python manage.py skema`.")
        return 2
    except ValueError as e:
        _galat(f"GAGAL: {e}")
        return 2

    print(f"OK: postingan #{args.id} disimpan -> status {STATUS[status]} (skor {bersih['skor']}, {bersih['jenis_acara']})")
    for p in peringatan:
        print(f"  PERINGATAN: {p}")
    return 0


def cmd_stats(args) -> int:
    with sesi() as db:
        st = layanan.statistik(db)
    if args.json:
        print(json.dumps(st, ensure_ascii=False, indent=2))
        return 0
    ps = st["per_status"]
    print(f"Ringkasan Pesanin ({tanggal_pendek(config.hari_ini())})")
    print(f"  Total postingan           : {st['total']}")
    print(f"  Menunggu /radar           : {st['menunggu_analisis']}")
    print(
        f"  Prospek aktif             : {st['prospek_aktif']} "
        f"(Baru {ps['baru']}, Sudah DM {ps['sudah_dm']}, Nego {ps['nego']})"
    )
    print(f"  Deal / Tolak              : {ps['deal']} / {ps['tolak']}")
    print(f"  Tidak relevan             : {ps['tidak_relevan']}")
    print(f"  Prospek bagus (skor >= {st['ambang_skor']}): {st['prospek_bagus']}")
    print(f"  Acara 7 hari ke depan     : {st['acara_7_hari_ke_depan']}")
    if st["teratas"]:
        print("\nProspek teratas (acara terdekat):")
        for p in st["teratas"]:
            tgl = p["tanggal_acara"]
            waktu = f"{tgl} ({label_sisa_hari(p['sisa_hari'])})" if tgl else "tanggal belum diketahui"
            kontak = ", ".join(x for x in (p["kontak_ig"] and "@" + p["kontak_ig"], p["kontak_wa"] and "WA " + p["kontak_wa"]) if x)
            print(f"  #{p['id']:<4} skor {p['skor']:<2} {waktu:<22} {p['nama_acara']}")
            print(f"        {KOTA.get(p['kota'] or '', '-')} | {STATUS[p['status']]} | {kontak or 'kontak belum ada'}")
    return 0


def cmd_tambah(args) -> int:
    gambar = None
    if args.gambar:
        try:
            gambar = Path(args.gambar).read_bytes()
        except OSError as e:
            _galat(f"GAGAL membaca gambar: {e}")
            return 2
    try:
        with sesi() as db:
            h = layanan.tambah_postingan(
                db, sumber="manual", permalink=args.link, caption=args.caption, akun_ig=args.akun, gambar=gambar
            )
            if h.duplikat:
                print(f"Duplikat: sudah ada sebagai postingan #{h.duplikat.id} ({STATUS[h.duplikat.status]}).")
                return 1
            print(f"OK: postingan #{h.postingan.id} ditambahkan (belum diproses).")
    except ValueError as e:
        _galat(f"GAGAL: {e}")
        return 2
    return 0


def cmd_skema(args) -> int:
    with sesi() as db:
        ambang = layanan.ambil_pengaturan(db)["ambang_skor"]
    print("Format JSON untuk `save-result` (semua kunci memakai huruf kecil):\n")
    print(json.dumps(contoh_hasil(), ensure_ascii=False, indent=2))
    print(f"\nKolom yang diizinkan: {', '.join(SEMUA_KOLOM)}")
    print("Wajib selalu: relevan (true/false), skor (1-10), jenis_acara, alasan.")
    print(f"Jika skor >= {ambang} (ambang saat ini): semua kolom wajib ada; isi null jika tidak diketahui.")
    print("Tanggal: 'YYYY-MM-DD'. Peserta: angka bulat. WA: teks, mis. '081234567890'.")
    print(f"\njenis_acara: {', '.join(JENIS_ACARA)}")
    print(f"kota       : {', '.join(KOTA)}")
    return 0


def cmd_seed_contoh(args) -> int:
    daftar = json.loads((FOLDER_CONTOH / "contoh.json").read_text(encoding="utf-8"))
    ditambah = dilewati = ke_inbox = 0
    with sesi() as db:
        for item in daftar:
            poster = FOLDER_CONTOH / "poster" / item["gambar"] if item.get("gambar") else None
            if item.get("lewat_inbox"):
                # Disalin ke inbox/ supaya ikut diproses oleh `collect` seperti screenshot sungguhan.
                if layanan.cari_duplikat(db, None, layanan.sha256_hex(poster.read_bytes())):
                    dilewati += 1
                    continue
                config.INBOX_DIR.mkdir(parents=True, exist_ok=True)
                shutil.copy(poster, config.INBOX_DIR / f"contoh_{poster.name}")
                ke_inbox += 1
                continue
            h = layanan.tambah_postingan(
                db,
                sumber="manual",
                permalink=item.get("permalink"),
                caption=item.get("caption"),
                akun_ig=item.get("akun_ig"),
                gambar=poster.read_bytes() if poster else None,
                tanggal_posting=datetime.fromisoformat(item["tanggal_posting"]) if item.get("tanggal_posting") else None,
                contoh=True,
            )
            if h.duplikat:
                dilewati += 1
            else:
                ditambah += 1
    print(f"Data contoh: {ditambah} ditambahkan, {dilewati} sudah ada, {ke_inbox} poster disalin ke inbox/.")
    print("Jalankan `python manage.py collect` (atau /radar) untuk memproses poster di inbox.")
    return 0


def cmd_hapus_contoh(args) -> int:
    with sesi() as db:
        posts = db.scalars(select(Postingan).where(Postingan.contoh.is_(True))).all()
        for p in posts:
            layanan.hapus_postingan(db, p)
    for path in config.INBOX_DIR.rglob("contoh_*"):
        path.unlink()
    print(f"{len(posts)} postingan contoh dihapus.")
    return 0


def cmd_serve(args) -> int:
    import uvicorn

    inisialisasi()
    print(f"Dashboard: http://{args.host}:{args.port}  (Ctrl+C untuk berhenti)")
    uvicorn.run("pesanin.web.app:app", host=args.host, port=args.port, reload=args.reload)
    return 0


def cmd_init_db(args) -> int:
    inisialisasi()
    print(f"Database siap: {config.DB_URL}")
    return 0


# ---------------------------------------------------------------------------


def buat_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(prog="manage.py", description="CLI Pesanin")
    sub = p.add_subparsers(dest="perintah", required=True, metavar="PERINTAH")

    s = sub.add_parser("collect", help="jalankan semua collector yang aktif")
    s.add_argument("--hanya", nargs="+", choices=[c.nama for c in semua_collector()], help="jalankan collector tertentu saja")
    s.set_defaults(fungsi=cmd_collect)

    s = sub.add_parser("pending", help="JSON postingan yang belum diproses")
    s.add_argument("--limit", type=int, default=20)
    s.set_defaults(fungsi=cmd_pending)

    s = sub.add_parser("save-result", help="validasi & simpan hasil analisis satu postingan")
    s.add_argument("id", type=int)
    sumber = s.add_mutually_exclusive_group(required=True)
    sumber.add_argument("--json", help="teks JSON, atau '-' untuk membaca dari stdin")
    sumber.add_argument("--file", help="path file berisi JSON")
    s.add_argument("--timpa", action="store_true", help="timpa hasil analisis yang sudah ada")
    s.set_defaults(fungsi=cmd_save_result)

    s = sub.add_parser("stats", help="ringkasan singkat")
    s.add_argument("--json", action="store_true", help="keluaran JSON")
    s.set_defaults(fungsi=cmd_stats)

    s = sub.add_parser("tambah", help="tambah postingan manual dari terminal")
    s.add_argument("--link")
    s.add_argument("--caption")
    s.add_argument("--akun", help="username Instagram pengunggah")
    s.add_argument("--gambar", help="path gambar poster")
    s.set_defaults(fungsi=cmd_tambah)

    s = sub.add_parser("skema", help="tampilkan format JSON save-result dan nilai yang diizinkan")
    s.set_defaults(fungsi=cmd_skema)

    s = sub.add_parser("seed-contoh", help="masukkan 8 data contoh fiktif")
    s.set_defaults(fungsi=cmd_seed_contoh)

    s = sub.add_parser("hapus-contoh", help="hapus semua data contoh")
    s.set_defaults(fungsi=cmd_hapus_contoh)

    s = sub.add_parser("serve", help="jalankan dashboard web")
    s.add_argument("--host", default="127.0.0.1")
    s.add_argument("--port", type=int, default=8000)
    s.add_argument("--reload", action="store_true", help="muat ulang otomatis saat kode berubah")
    s.set_defaults(fungsi=cmd_serve)

    s = sub.add_parser("init-db", help="buat database jika belum ada")
    s.set_defaults(fungsi=cmd_init_db)
    return p


def main(argv: list[str] | None = None) -> int:
    _utf8()
    args = buat_parser().parse_args(argv)
    return args.fungsi(args)


if __name__ == "__main__":
    sys.exit(main())

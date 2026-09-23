"""Dashboard web Pesanin (FastAPI + Jinja2 + Tailwind CDN)."""

from __future__ import annotations

import math
import re
from datetime import date
from pathlib import Path
from urllib.parse import quote, urlencode, urlsplit

from fastapi import Depends, FastAPI, Form, HTTPException, Request, UploadFile
from fastapi.responses import JSONResponse, PlainTextResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from .. import config, layanan, normalisasi
from ..collectors import jalankan_semua
from ..db import buka_sesi
from ..format import BULAN, label_sisa_hari, nomor_wa, tanggal_panjang, tanggal_pendek, waktu
from ..konstanta import (
    BATAS_HASHTAG_UNIK,
    JENIS_ACARA,
    KOTA,
    MAKS_UKURAN_GAMBAR,
    STATUS,
    STATUS_AKTIF,
    SUMBER,
)
from ..models import AkunPantauan, Hashtag, KataPengecualian, Postingan

FOLDER = Path(__file__).resolve().parent
config.MEDIA_DIR.mkdir(parents=True, exist_ok=True)

app = FastAPI(title="Pesanin", docs_url=None, redoc_url=None, openapi_url=None)
app.mount("/static", StaticFiles(directory=FOLDER / "static"), name="static")
app.mount("/media", StaticFiles(directory=config.MEDIA_DIR), name="media")
templates = Jinja2Templates(directory=FOLDER / "templates")


def url_wa(post: Postingan) -> str:
    teks = f"?text={quote(post.draf_dm)}" if post.draf_dm else ""
    return f"https://wa.me/{post.kontak_wa or ''}{teks}"


def mendesak(post: Postingan, hari_mendesak: int) -> bool:
    sisa = post.sisa_hari
    return sisa is not None and 0 <= sisa < hari_mendesak


templates.env.globals.update(
    STATUS=STATUS,
    JENIS_ACARA=JENIS_ACARA,
    KOTA=KOTA,
    SUMBER=SUMBER,
    tanggal_pendek=tanggal_pendek,
    tanggal_panjang=tanggal_panjang,
    label_sisa_hari=label_sisa_hari,
    waktu=waktu,
    nomor_wa=nomor_wa,
    url_wa=url_wa,
    mendesak=mendesak,
)


@app.middleware("http")
async def tolak_asal_lain(request: Request, call_next):
    """Cegah situs lain mengirim form ke dashboard lokal ini (CSRF sederhana)."""
    if request.method not in ("GET", "HEAD", "OPTIONS"):
        origin = request.headers.get("origin")
        if origin and origin != "null" and urlsplit(origin).netloc != request.headers.get("host"):
            return PlainTextResponse("Permintaan ditolak: asal berbeda.", status_code=403)
    return await call_next(request)


def get_db():
    db = buka_sesi()
    try:
        yield db
    finally:
        db.close()


def render(request: Request, db: Session, nama: str, **konteks):
    konteks.setdefault("pesan", request.query_params.get("pesan"))
    konteks.setdefault("jenis_pesan", request.query_params.get("jenis", "ok"))
    konteks["jumlah_pending"] = layanan.hitung_status(db)["belum_diproses"]
    konteks["pengaturan"] = layanan.ambil_pengaturan(db)
    return templates.TemplateResponse(request, nama, konteks)


def alihkan(url: str, pesan: str | None = None, jenis: str = "ok") -> RedirectResponse:
    if pesan:
        url += ("&" if "?" in url else "?") + urlencode({"pesan": pesan, "jenis": jenis})
    return RedirectResponse(url, status_code=303)


def ambil_postingan(db: Session, id: int) -> Postingan:
    post = db.get(Postingan, id)
    if post is None:
        raise HTTPException(404, "Postingan tidak ditemukan")
    return post


# ---------------------------------------------------------------------------
# Daftar prospek
# ---------------------------------------------------------------------------

URUTAN = {"tanggal": "Tanggal terdekat", "skor": "Skor tertinggi", "terbaru": "Terbaru masuk"}


def _int(teks: str | None, bawah: int, atas: int) -> int | None:
    try:
        n = int(teks)
    except (TypeError, ValueError):
        return None
    return n if bawah <= n <= atas else None


def _tanggal(teks: str | None) -> date | None:
    try:
        return date.fromisoformat(teks) if teks else None
    except ValueError:
        return None


@app.get("/")
def daftar(request: Request, db: Session = Depends(get_db)):
    q = request.query_params
    f = {
        "status": q.get("status") if q.get("status") in ("aktif", "semua", *STATUS) else "aktif",
        "jenis": q.get("jenis") if q.get("jenis") in JENIS_ACARA else "",
        "kota": q.get("kota") if q.get("kota") in KOTA else "",
        "dari": _tanggal(q.get("dari")),
        "sampai": _tanggal(q.get("sampai")),
        "skor_min": _int(q.get("skor_min"), 1, 10),
        "lewat": q.get("lewat") == "1",
        "cari": (q.get("cari") or "").strip(),
        "urut": q.get("urut") if q.get("urut") in URUTAN else "tanggal",
    }

    kueri = select(Postingan)
    if f["status"] == "aktif":
        kueri = kueri.where(Postingan.status.in_(STATUS_AKTIF))
    elif f["status"] != "semua":
        kueri = kueri.where(Postingan.status == f["status"])
    if f["jenis"]:
        kueri = kueri.where(Postingan.jenis_acara == f["jenis"])
    if f["kota"]:
        kueri = kueri.where(Postingan.kota == f["kota"])
    if f["dari"]:
        kueri = kueri.where(Postingan.tanggal_acara >= f["dari"])
    if f["sampai"]:
        kueri = kueri.where(Postingan.tanggal_acara <= f["sampai"])
    if f["skor_min"]:
        kueri = kueri.where(Postingan.skor >= f["skor_min"])
    if not f["lewat"] and not f["dari"]:
        kueri = kueri.where(or_(Postingan.tanggal_acara.is_(None), Postingan.tanggal_acara >= config.hari_ini()))
    if f["cari"]:
        pola = f"%{f['cari']}%"
        kueri = kueri.where(
            or_(*(kolom.ilike(pola) for kolom in (
                Postingan.nama_acara, Postingan.penyelenggara, Postingan.lokasi,
                Postingan.caption, Postingan.akun_ig, Postingan.kontak_ig,
            )))
        )
    posts = db.scalars(kueri).all()
    if f["urut"] == "skor":
        posts = sorted(posts, key=lambda p: (-(p.skor or 0), layanan.kunci_urut_tanggal(p)))
    elif f["urut"] == "terbaru":
        posts = sorted(posts, key=lambda p: p.dikumpulkan_pada, reverse=True)
    else:
        posts = sorted(posts, key=layanan.kunci_urut_tanggal)

    jumlah_filter = sum(bool(f[k]) for k in ("jenis", "kota", "dari", "sampai", "skor_min", "lewat", "cari"))
    return render(
        request, db, "prospek.html", halaman="prospek", posts=posts, f=f,
        URUTAN=URUTAN, jumlah_filter=jumlah_filter,
    )


@app.get("/prospek/{id}")
def detail(request: Request, id: int, db: Session = Depends(get_db)):
    post = ambil_postingan(db, id)
    return render(request, db, "detail.html", halaman="prospek", p=post)


def _teks_form(nilai: object) -> str | None:
    teks = str(nilai or "").strip()
    return teks or None


@app.post("/prospek/{id}")
async def simpan_detail(request: Request, id: int, db: Session = Depends(get_db)):
    """Simpan follow-up dan koreksi data acara. Hanya kolom yang dikirim form yang diubah."""
    post = ambil_postingan(db, id)
    form = await request.form()
    salah: list[str] = []
    ubah: dict = {}

    status_baru = form.get("status")
    if status_baru is not None and status_baru not in STATUS:
        salah.append("Status tidak dikenal.")
    for kolom, pilihan, label in (("jenis_acara", JENIS_ACARA, "Jenis acara"), ("kota", KOTA, "Kota")):
        if kolom in form:
            nilai = form[kolom] or None
            if nilai is not None and nilai not in pilihan:
                salah.append(f"{label} tidak dikenal.")
            ubah[kolom] = nilai
    for kolom in ("nama_acara", "penyelenggara", "lokasi", "draf_dm", "catatan"):
        if kolom in form:
            ubah[kolom] = _teks_form(form[kolom])
    if "tanggal_acara" in form:
        ubah["tanggal_acara"] = _tanggal(form["tanggal_acara"])
        if form["tanggal_acara"] and ubah["tanggal_acara"] is None:
            salah.append("Tanggal acara tidak valid.")
    if "perkiraan_peserta" in form:
        ubah["perkiraan_peserta"] = _int(form["perkiraan_peserta"], 1, 100_000)
        if form["perkiraan_peserta"] and ubah["perkiraan_peserta"] is None:
            salah.append("Perkiraan peserta harus angka 1-100000.")
    for kolom, fungsi in (("kontak_ig", normalisasi.username), ("kontak_wa", normalisasi.nomor_wa)):
        if kolom in form:
            try:
                ubah[kolom] = fungsi(form[kolom])
            except ValueError as e:
                salah.append(str(e))
    dihubungi = _tanggal(form.get("terakhir_dihubungi"))
    if form.get("terakhir_dihubungi") and dihubungi is None:
        salah.append("Tanggal terakhir dihubungi tidak valid.")

    if salah:
        return render(request, db, "detail.html", halaman="prospek", p=post, pesan=" ".join(salah), jenis_pesan="galat")

    for kolom, nilai in ubah.items():
        setattr(post, kolom, nilai)
    dihubungi_awal = post.terakhir_dihubungi
    if status_baru:
        layanan.ubah_status(db, post, status_baru, "Diubah dari dashboard")
    # Tanggal yang diubah manual menang atas tanggal otomatis dari perubahan status.
    if "terakhir_dihubungi" in form and dihubungi != dihubungi_awal:
        post.terakhir_dihubungi = dihubungi
    db.commit()
    return alihkan(f"/prospek/{id}", "Perubahan tersimpan.")


@app.post("/api/prospek/{id}/status")
async def api_ubah_status(request: Request, id: int, db: Session = Depends(get_db)):
    post = ambil_postingan(db, id)
    try:
        data = await request.json()
    except ValueError:
        data = {}
    status = data.get("status") if isinstance(data, dict) else None
    if status not in STATUS:
        return JSONResponse({"ok": False, "pesan": "Status tidak dikenal."}, status_code=400)
    layanan.ubah_status(db, post, status, "Diubah dari dashboard")
    db.commit()
    return {
        "ok": True,
        "status": status,
        "label": STATUS[status],
        "terakhir_dihubungi": tanggal_pendek(post.terakhir_dihubungi) if post.terakhir_dihubungi else None,
    }


@app.post("/prospek/{id}/hapus")
def hapus(id: int, db: Session = Depends(get_db)):
    post = ambil_postingan(db, id)
    judul = post.judul
    layanan.hapus_postingan(db, post)
    db.commit()
    return alihkan("/?status=semua", f"Postingan \"{judul}\" dihapus.")


# ---------------------------------------------------------------------------
# Input manual
# ---------------------------------------------------------------------------


@app.get("/tambah")
def form_tambah(request: Request, db: Session = Depends(get_db)):
    return render(request, db, "tambah.html", halaman="tambah", isian={}, inbox=config.INBOX_DIR)


@app.post("/tambah")
async def simpan_tambah(
    request: Request,
    permalink: str = Form(""),
    akun_ig: str = Form(""),
    caption: str = Form(""),
    gambar: UploadFile | None = None,
    db: Session = Depends(get_db),
):
    isian = {"permalink": permalink, "akun_ig": akun_ig, "caption": caption}
    data_gambar = None
    if gambar is not None and gambar.filename:
        data_gambar = await gambar.read(MAKS_UKURAN_GAMBAR + 1)
    try:
        hasil = layanan.tambah_postingan(
            db, sumber="manual", permalink=permalink, caption=caption, akun_ig=akun_ig, gambar=data_gambar
        )
    except ValueError as e:
        db.rollback()
        return render(
            request, db, "tambah.html", halaman="tambah", isian=isian, inbox=config.INBOX_DIR,
            pesan=str(e), jenis_pesan="galat",
        )
    if hasil.duplikat:
        return render(
            request, db, "tambah.html", halaman="tambah", isian=isian, inbox=config.INBOX_DIR,
            duplikat=hasil.duplikat,
        )
    db.commit()
    return alihkan(
        f"/prospek/{hasil.postingan.id}",
        "Postingan tersimpan. Jalankan /radar di Claude Code untuk menilainya.",
    )


@app.post("/collect")
def jalankan_collect(db: Session = Depends(get_db)):
    hasil = jalankan_semua(db)
    db.commit()
    ringkas = "; ".join(f"{h.label}: {h.ringkas()}" for h in hasil)
    ada_galat = any(h.galat for h in hasil)
    return alihkan("/", f"Selesai mengumpulkan. {ringkas}", "galat" if ada_galat else "ok")


# ---------------------------------------------------------------------------
# Ringkasan
# ---------------------------------------------------------------------------

PILIHAN_MINGGU = (4, 8, 12, 26)
# Slot kategorikal 1-3 (sudah divalidasi aman untuk buta warna, semua pasangan).
GRAFIK = (
    ("prospek", "Prospek baru", "#2a78d6"),
    ("dm", "DM terkirim", "#eb6834"),
    ("deal", "Deal", "#1baf7a"),
)


def _sumbu(maks: int) -> tuple[int, list[int]]:
    """Batas atas dan tick bulat untuk sumbu Y (2-5 tick)."""
    for langkah in (1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000):
        if maks <= langkah * 4:
            atas = langkah * max(1, math.ceil(maks / langkah))
            return atas, list(range(0, atas + 1, langkah))
    return maks, [0, maks]


def _label_minggu(d: date) -> str:
    return f"{d.day} {BULAN[d.month - 1][:3]}"


@app.get("/ringkasan")
def halaman_ringkasan(request: Request, minggu: int = 8, db: Session = Depends(get_db)):
    if minggu not in PILIHAN_MINGGU:
        minggu = 8
    data = layanan.ringkasan(db, minggu)
    grafik = []
    for kunci, judul, warna in GRAFIK:
        atas, tick = _sumbu(max(m[kunci] for m in data["minggu"]))
        grafik.append({
            "kunci": kunci, "judul": judul, "warna": warna, "tick": tick, "atas": atas,
            "total": data["total"][kunci],
            "kolom": [
                {"label": _label_minggu(m["mulai"]), "nilai": m[kunci], "persen": m[kunci] / atas * 100}
                for m in data["minggu"]
            ],
        })
    st = layanan.statistik(db)
    per_kota = sorted(
        ((KOTA.get(k, "Belum diketahui") if k else "Belum diketahui", v) for k, v in data["per_kota"].items()),
        key=lambda x: -x[1]["prospek"],
    )
    return render(
        request, db, "ringkasan.html", halaman="ringkasan", data=data, grafik=grafik, minggu=minggu,
        PILIHAN_MINGGU=PILIHAN_MINGGU, per_kota=per_kota, st=st,
        label_minggu=[_label_minggu(m["mulai"]) for m in data["minggu"]],
    )


# ---------------------------------------------------------------------------
# Pengaturan
# ---------------------------------------------------------------------------


def _kata(teks: str) -> str:
    kata = " ".join(teks.lower().split())
    if not 2 <= len(kata) <= 100:
        raise ValueError(f"Kata pengecualian {teks!r} harus 2-100 karakter.")
    return kata


# jenis -> (model, kolom, fungsi normalisasi, label)
DAFTAR_PENGATURAN = {
    "hashtag": (Hashtag, "nama", normalisasi.hashtag, "Hashtag"),
    "akun": (AkunPantauan, "username", normalisasi.username, "Akun"),
    "pengecualian": (KataPengecualian, "kata", _kata, "Kata pengecualian"),
}


def _pecah(teks: str, jenis: str) -> list[str]:
    # Kata pengecualian boleh berisi spasi, jadi hanya dipisah koma/baris baru.
    pemisah = r"[,\n]+" if jenis == "pengecualian" else r"[\s,]+"
    return [b for b in re.split(pemisah, teks) if b.strip()]


@app.get("/pengaturan")
def pengaturan(request: Request, db: Session = Depends(get_db)):
    pemakaian = layanan.pemakaian_hashtag(db)
    return render(
        request, db, "pengaturan.html", halaman="pengaturan",
        hashtag=db.scalars(select(Hashtag).order_by(Hashtag.aktif.desc(), Hashtag.nama)).all(),
        akun=db.scalars(select(AkunPantauan).order_by(AkunPantauan.aktif.desc(), AkunPantauan.username)).all(),
        pengecualian=db.scalars(select(KataPengecualian).order_by(KataPengecualian.kata)).all(),
        pemakaian=sorted(pemakaian.items(), key=lambda x: x[1]),
        batas_hashtag=BATAS_HASHTAG_UNIK,
        graph_aktif=config.graph_api_aktif(),
        ig_user_id=config.IG_USER_ID,
        versi_api=config.GRAPH_API_VERSION,
        inbox=config.INBOX_DIR,
    )


@app.post("/pengaturan/umum")
def simpan_pengaturan_umum(
    ambang_skor: str = Form(...), hari_mendesak: str = Form(...), db: Session = Depends(get_db)
):
    ambang = _int(ambang_skor, 1, 10)
    hari = _int(hari_mendesak, 1, 30)
    if ambang is None or hari is None:
        return alihkan("/pengaturan", "Ambang skor harus 1-10 dan batas mendesak 1-30 hari.", "galat")
    layanan.simpan_pengaturan(db, ambang_skor=ambang, hari_mendesak=hari)
    db.commit()
    return alihkan("/pengaturan", "Pengaturan penilaian tersimpan.")


@app.post("/pengaturan/{jenis}")
def tambah_pengaturan(jenis: str, isi: str = Form(""), db: Session = Depends(get_db)):
    if jenis not in DAFTAR_PENGATURAN:
        raise HTTPException(404)
    model, kolom, fungsi, label = DAFTAR_PENGATURAN[jenis]
    ditambah, salah = [], []
    for bagian in _pecah(isi, jenis):
        try:
            nilai = fungsi(bagian)
        except ValueError as e:
            salah.append(str(e))
            continue
        if db.scalar(select(model).where(getattr(model, kolom) == nilai)) is None and nilai not in ditambah:
            db.add(model(**{kolom: nilai}))
            ditambah.append(nilai)
    db.commit()
    pesan = f"{label} ditambahkan: {', '.join(ditambah)}." if ditambah else f"Tidak ada {label.lower()} baru."
    if jenis == "hashtag":
        aktif = len(db.scalars(select(Hashtag).where(Hashtag.aktif.is_(True))).all())
        if aktif > BATAS_HASHTAG_UNIK:
            salah.append(
                f"Ada {aktif} hashtag aktif, melebihi batas Instagram {BATAS_HASHTAG_UNIK} hashtag unik per 7 hari; "
                "sebagian akan dilewati."
            )
    if salah:
        return alihkan(f"/pengaturan#{jenis}", f"{pesan} {' '.join(salah)}", "galat")
    return alihkan(f"/pengaturan#{jenis}", pesan)


@app.post("/pengaturan/{jenis}/{id}/aktif")
def ubah_aktif_pengaturan(jenis: str, id: int, db: Session = Depends(get_db)):
    if jenis not in ("hashtag", "akun"):
        raise HTTPException(404)
    baris = db.get(DAFTAR_PENGATURAN[jenis][0], id)
    if baris is None:
        raise HTTPException(404)
    baris.aktif = not baris.aktif
    db.commit()
    return alihkan(f"/pengaturan#{jenis}")


@app.post("/pengaturan/{jenis}/{id}/hapus")
def hapus_pengaturan(jenis: str, id: int, db: Session = Depends(get_db)):
    if jenis not in DAFTAR_PENGATURAN:
        raise HTTPException(404)
    baris = db.get(DAFTAR_PENGATURAN[jenis][0], id)
    if baris is not None:
        db.delete(baris)
        db.commit()
    return alihkan(f"/pengaturan#{jenis}")

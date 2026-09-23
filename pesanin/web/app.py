"""Dashboard web Pesanin (FastAPI + Jinja2 + Tailwind CDN)."""

from __future__ import annotations

from pathlib import Path
from urllib.parse import quote, urlencode, urlsplit

from fastapi import Depends, FastAPI, Form, HTTPException, Request, UploadFile
from fastapi.responses import PlainTextResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import config, layanan
from ..collectors import jalankan_semua
from ..db import buka_sesi
from ..format import label_sisa_hari, tanggal_panjang, tanggal_pendek, waktu
from ..konstanta import JENIS_ACARA, KOTA, MAKS_UKURAN_GAMBAR, STATUS, STATUS_AKTIF, SUMBER
from ..models import Postingan

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

TAB = {
    "aktif": ("Prospek aktif", STATUS_AKTIF),
    "belum_diproses": ("Belum diproses", ("belum_diproses",)),
    "semua": ("Semua", tuple(STATUS)),
}


@app.get("/")
def daftar(request: Request, tab: str = "aktif", db: Session = Depends(get_db)):
    if tab not in TAB:
        tab = "aktif"
    posts = db.scalars(select(Postingan).where(Postingan.status.in_(TAB[tab][1]))).all()
    posts = sorted(posts, key=layanan.kunci_urut_tanggal)
    return render(request, db, "prospek.html", halaman="prospek", posts=posts, tab=tab, TAB=TAB)


@app.get("/prospek/{id}")
def detail(request: Request, id: int, db: Session = Depends(get_db)):
    post = ambil_postingan(db, id)
    return render(request, db, "detail.html", halaman="prospek", p=post)


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

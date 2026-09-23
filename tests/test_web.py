import re
from datetime import timedelta

import pytest
from fastapi.testclient import TestClient

from pesanin import layanan
from pesanin.config import hari_ini
from pesanin.web.app import app


@pytest.fixture
def klien(db):
    return TestClient(app)


def buat_prospek(db, caption, sisa_hari, skor=8, kota="bandung", **kolom):
    post = layanan.tambah_postingan(db, sumber="manual", caption=caption).postingan
    post.relevan, post.skor, post.jenis_acara, post.kota = True, skor, "seminar", kota
    post.nama_acara = caption
    post.tanggal_acara = hari_ini() + timedelta(days=sisa_hari) if sisa_hari is not None else None
    for k, v in kolom.items():
        setattr(post, k, v)
    layanan.ubah_status(db, post, "baru")
    db.commit()
    return post


def judul_kartu(html):
    return re.findall(r'<a href="/prospek/\d+" class="font-semibold[^>]*>([^<]+)</a>', html)


def test_urutan_default_dan_tandai_merah(db, klien):
    buat_prospek(db, "Acara jauh", 20, skor=9)
    buat_prospek(db, "Acara besok", 1, skor=6)
    buat_prospek(db, "Tanpa tanggal", None, skor=10)
    buat_prospek(db, "Sudah lewat", -3)
    html = klien.get("/").text
    assert judul_kartu(html) == ["Acara besok", "Acara jauh", "Tanpa tanggal"]
    assert html.count("ring-red-100") == 1
    assert "Sudah lewat" in klien.get("/?lewat=1").text


def test_filter(db, klien):
    buat_prospek(db, "Seminar Garut", 5, kota="garut", skor=7)
    buat_prospek(db, "Seminar Bandung", 9, skor=9)
    assert judul_kartu(klien.get("/?kota=garut").text) == ["Seminar Garut"]
    assert judul_kartu(klien.get("/?skor_min=8").text) == ["Seminar Bandung"]
    sampai = (hari_ini() + timedelta(days=6)).isoformat()
    assert judul_kartu(klien.get(f"/?sampai={sampai}").text) == ["Seminar Garut"]
    assert judul_kartu(klien.get("/?urut=skor").text) == ["Seminar Bandung", "Seminar Garut"]
    assert klien.get("/?skor_min=x&dari=bukan-tanggal").status_code == 200


def test_tombol_wa_dan_salin(db, klien):
    buat_prospek(db, "Pengajian", 10, kontak_wa="6281200000101", draf_dm="Assalamu'alaikum & salam")
    html = klien.get("/").text
    assert "https://wa.me/6281200000101?text=Assalamu%27alaikum%20%26%20salam" in html
    assert 'data-salin="Assalamu&#39;alaikum &amp; salam"' in html
    assert "0812-0000-0101" in html


def test_api_status(db, klien):
    post = buat_prospek(db, "Gathering", 10)
    r = klien.post(f"/api/prospek/{post.id}/status", json={"status": "sudah_dm"})
    assert r.json()["ok"] and r.json()["label"] == "Sudah DM"
    db.refresh(post)
    assert post.status == "sudah_dm" and post.terakhir_dihubungi == hari_ini()
    assert klien.post(f"/api/prospek/{post.id}/status", json={"status": "ngawur"}).status_code == 400


def test_simpan_detail_hanya_kolom_terkirim(db, klien):
    post = buat_prospek(db, "Wisuda", 10, kontak_wa="6281200000101", lokasi="Aula")
    kemarin = (hari_ini() - timedelta(days=1)).isoformat()
    r = klien.post(
        f"/prospek/{post.id}",
        data={"status": "nego", "catatan": "Minta 150 box", "terakhir_dihubungi": kemarin},
        follow_redirects=False,
    )
    assert r.status_code == 303
    db.refresh(post)
    assert (post.status, post.catatan, post.terakhir_dihubungi.isoformat()) == ("nego", "Minta 150 box", kemarin)
    assert post.lokasi == "Aula" and post.kontak_wa == "6281200000101"

    r = klien.post(f"/prospek/{post.id}", data={"kontak_wa": "123", "lokasi": "Gedung"})
    assert "tidak valid" in r.text
    db.refresh(post)
    assert post.lokasi == "Aula"


def test_hapus(db, klien):
    post = buat_prospek(db, "Hapus aku", 3)
    assert klien.post(f"/prospek/{post.id}/hapus", follow_redirects=False).status_code == 303
    assert klien.get(f"/prospek/{post.id}").status_code == 404


def test_tolak_asal_lain(db, klien):
    r = klien.post("/tambah", data={"caption": "x"}, headers={"origin": "https://situs-lain.example"})
    assert r.status_code == 403


def test_pengaturan(db, klien):
    from sqlalchemy import select

    from pesanin.models import AkunPantauan, Hashtag, KataPengecualian

    assert klien.get("/pengaturan").status_code == 200
    r = klien.post("/pengaturan/hashtag", data={"isi": "#SeminarCirebon, wisudagarut  bukan-valid"}, follow_redirects=False)
    assert "tidak+valid" in r.headers["location"]
    nama = set(db.scalars(select(Hashtag.nama)))
    assert {"seminarcirebon", "wisudagarut"} <= nama and "bukan-valid" not in nama

    klien.post("/pengaturan/akun", data={"isi": "@Info.Bandung https://www.instagram.com/bem.kampus/"})
    assert set(db.scalars(select(AkunPantauan.username))) == {"info.bandung", "bem.kampus"}

    klien.post("/pengaturan/pengecualian", data={"isi": "Jual Beli Akun, promo pulsa"})
    kata = db.scalar(select(KataPengecualian).where(KataPengecualian.kata == "jual beli akun"))
    assert kata is not None and db.scalar(select(KataPengecualian).where(KataPengecualian.kata == "promo pulsa"))

    akun = db.scalar(select(AkunPantauan).where(AkunPantauan.username == "bem.kampus"))
    klien.post(f"/pengaturan/akun/{akun.id}/aktif")
    db.refresh(akun)
    assert akun.aktif is False
    id_kata = kata.id
    klien.post(f"/pengaturan/pengecualian/{id_kata}/hapus")
    db.expire_all()
    assert db.get(KataPengecualian, id_kata) is None

    klien.post("/pengaturan/umum", data={"ambang_skor": "7", "hari_mendesak": "5"})
    assert layanan.ambil_pengaturan(db) == {"ambang_skor": 7, "hari_mendesak": 5}
    r = klien.post("/pengaturan/umum", data={"ambang_skor": "11", "hari_mendesak": "5"}, follow_redirects=False)
    assert "jenis=galat" in r.headers["location"]

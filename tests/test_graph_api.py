from datetime import timedelta

import pytest
from sqlalchemy import select, update

from pesanin import config, layanan
from pesanin.collectors.ig_akun import AkunCollector
from pesanin.collectors.ig_hashtag import HashtagCollector
from pesanin.collectors.instagram import GraphAPIError, url_gambar, waktu_ig
from pesanin.models import AkunPantauan, Hashtag, PemakaianHashtag, Postingan


class KlienPalsu:
    def __init__(self, jawab, gambar):
        self.jawab = jawab
        self.gambar = gambar
        self.panggilan = []

    def get(self, path, **params):
        self.panggilan.append((path, params))
        hasil = self.jawab(path, params)
        if isinstance(hasil, Exception):
            raise hasil
        return hasil

    def unduh_gambar(self, url):
        # Isi berbeda per URL agar tidak dianggap gambar duplikat.
        return self.gambar + url.encode() if url else None


def media(kode, caption, jenis="IMAGE", jam_lalu=2, **lain):
    waktu = (config.sekarang() - timedelta(hours=jam_lalu + 7)).strftime("%Y-%m-%dT%H:%M:%S+0000")
    return {
        "id": f"id-{kode}",
        "caption": caption,
        "media_type": jenis,
        "media_url": f"https://cdn.contoh/{kode}.jpg",
        "permalink": f"https://www.instagram.com/p/{kode}/",
        "timestamp": waktu,
        **lain,
    }


@pytest.fixture
def token(monkeypatch):
    monkeypatch.setattr(config, "IG_ACCESS_TOKEN", "token-uji")
    monkeypatch.setattr(config, "IG_USER_ID", "1789")


@pytest.fixture
def hashtag_uji(db):
    db.execute(update(Hashtag).values(aktif=False))
    db.add_all([Hashtag(nama="ujiseminar"), Hashtag(nama="ujigarut")])
    db.commit()


def test_nonaktif_tanpa_token(db):
    hasil = HashtagCollector().jalankan(db)
    assert not hasil.aktif and ".env" in hasil.keterangan


def test_hashtag_collector(db, png, token, hashtag_uji):
    def jawab(path, params):
        if path == "ig_hashtag_search":
            return {"data": [{"id": f"tag-{params['q']}"}]}
        if path == "tag-ujiseminar/recent_media":
            return {"data": [
                media("A1", "Seminar kewirausahaan, free lunch"),
                media("A2", "Giveaway pulsa! Ikuti akun kami"),
            ]}
        if path == "tag-ujigarut/recent_media":
            return {"data": [
                media("A1", "Seminar kewirausahaan, free lunch"),
                media("B1", "Gathering kantor", jenis="CAROUSEL_ALBUM", media_url=None,
                      children={"data": [{"media_type": "IMAGE", "media_url": "https://cdn.contoh/b1.jpg"}]}),
            ]}
        raise AssertionError(path)

    klien = KlienPalsu(jawab, png)
    hasil = HashtagCollector(lambda: klien).jalankan(db)
    assert (hasil.baru, hasil.duplikat, hasil.dikecualikan, hasil.galat) == (2, 1, 1, [])
    posts = {p.permalink.split("/")[-2]: p for p in db.scalars(select(Postingan))}
    assert posts["A1"].sumber == "ig_hashtag" and posts["A1"].sumber_ref == "#ujiseminar"
    assert posts["A1"].path_gambar and posts["B1"].path_gambar
    assert posts["A2"].status == "tidak_relevan"
    assert set(layanan.pemakaian_hashtag(db)) == {"ujiseminar", "ujigarut"}
    assert db.scalar(select(Hashtag).where(Hashtag.nama == "ujigarut")).ig_hashtag_id == "tag-ujigarut"

    # Jalankan lagi: ID hashtag sudah tersimpan, tidak perlu ig_hashtag_search lagi.
    klien.panggilan.clear()
    HashtagCollector(lambda: klien).jalankan(db)
    assert all(p != "ig_hashtag_search" for p, _ in klien.panggilan)


def test_batas_30_hashtag(db, png, token, hashtag_uji):
    db.add_all(PemakaianHashtag(hashtag=f"lain{i}") for i in range(30))
    db.commit()
    klien = KlienPalsu(lambda p, q: {"data": []}, png)
    hasil = HashtagCollector(lambda: klien).jalankan(db)
    assert klien.panggilan == []
    assert "Batas 30" in hasil.galat[0] and "#ujiseminar" in hasil.galat[0]


def test_token_kedaluwarsa_berhenti(db, png, token, hashtag_uji):
    klien = KlienPalsu(lambda p, q: GraphAPIError("Session has expired", 190), png)
    hasil = HashtagCollector(lambda: klien).jalankan(db)
    assert len(klien.panggilan) == 1
    assert "perbarui IG_ACCESS_TOKEN" in hasil.galat[0]


def test_akun_collector(db, png, token):
    db.add_all([AkunPantauan(username="hima.contoh"), AkunPantauan(username="akun.pribadi")])
    db.commit()

    def jawab(path, params):
        assert path == "1789"
        if "akun.pribadi" in params["fields"]:
            return GraphAPIError("Cannot find User", 110)
        return {"business_discovery": {"username": "hima.contoh", "media": {"data": [
            media("C1", "Seminar minggu depan"),
            media("C2", "Video teaser", jenis="VIDEO", media_url="https://cdn/v.mp4", thumbnail_url="https://cdn/t.jpg"),
            media("C3", "Acara tahun lalu", jam_lalu=24 * 60),
        ]}}}

    hasil = AkunCollector(lambda: KlienPalsu(jawab, png)).jalankan(db)
    assert hasil.baru == 2 and len(hasil.galat) == 1 and "akun.pribadi" in hasil.galat[0]
    c1 = db.scalar(select(Postingan).where(Postingan.ig_media_id == "id-C1"))
    assert c1.akun_ig == "hima.contoh" and c1.sumber == "ig_akun"
    akun = db.scalar(select(AkunPantauan).where(AkunPantauan.username == "akun.pribadi"))
    assert "Cannot find User" in akun.pesan_terakhir


def test_pembantu():
    assert url_gambar({"media_type": "VIDEO", "media_url": "v.mp4", "thumbnail_url": "t.jpg"}) == "t.jpg"
    w = waktu_ig("2026-09-22T10:00:00+0000")
    assert (w.hour, w.tzinfo) == (17, None)

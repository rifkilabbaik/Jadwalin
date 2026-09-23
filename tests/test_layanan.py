import pytest

from pesanin import layanan
from pesanin.collectors.inbox import InboxCollector, baca_teks_pendamping
from pesanin.validasi import validasi_hasil


def test_duplikat_berdasarkan_permalink_dan_gambar(db, png):
    a = layanan.tambah_postingan(db, sumber="manual", permalink="https://www.instagram.com/p/AAA/", caption="x")
    assert a.postingan and not a.duplikat
    b = layanan.tambah_postingan(db, sumber="manual", permalink="instagram.com/reel/AAA?igsh=1", caption="y")
    assert b.duplikat.id == a.postingan.id
    c = layanan.tambah_postingan(db, sumber="manual", gambar=png)
    d = layanan.tambah_postingan(db, sumber="inbox", gambar=png)
    assert c.postingan and d.duplikat.id == c.postingan.id


def test_postingan_kosong_ditolak(db):
    with pytest.raises(ValueError):
        layanan.tambah_postingan(db, sumber="manual", caption="   ")


def test_kata_pengecualian(db):
    h = layanan.tambah_postingan(db, sumber="inbox", caption="Dicari reseller! OPEN RESELLER sekarang", cek_pengecualian=True)
    assert h.dikecualikan == "open reseller"
    assert h.postingan.status == "tidak_relevan"


def test_simpan_hasil_menentukan_status(db):
    p1 = layanan.tambah_postingan(db, sumber="manual", caption="satu").postingan
    p2 = layanan.tambah_postingan(db, sumber="manual", caption="dua").postingan
    rendah, _ = validasi_hasil({"relevan": False, "skor": 2, "jenis_acara": "bukan_acara", "alasan": "x"}, 6)
    assert layanan.simpan_hasil_analisis(db, p1, rendah, 6) == "tidak_relevan"
    tinggi, _ = validasi_hasil(
        {
            "relevan": True, "skor": 9, "jenis_acara": "pengajian", "alasan": "x", "nama_acara": "Tabligh Akbar",
            "penyelenggara": None, "tanggal_acara": None, "lokasi": None, "kota": "cirebon",
            "perkiraan_peserta": None, "kontak_ig": None, "kontak_wa": None, "catatan": None,
            "draf_dm": "Assalamu'alaikum, kami lihat info Tabligh Akbar, ada paket ayam goreng.",
        },
        6,
    )
    assert layanan.simpan_hasil_analisis(db, p2, tinggi, 6) == "baru"
    with pytest.raises(ValueError, match="--timpa"):
        layanan.simpan_hasil_analisis(db, p2, tinggi, 6)
    layanan.ubah_status(db, p2, "sudah_dm")
    assert p2.terakhir_dihubungi is not None
    # Menimpa analisis tidak boleh mengubah status follow-up.
    assert layanan.simpan_hasil_analisis(db, p2, rendah, 6, timpa=True) == "sudah_dm"
    assert [r.ke for r in p2.riwayat] == ["belum_diproses", "baru", "sudah_dm"]


def test_teks_pendamping():
    link, akun, caption = baca_teks_pendamping("https://www.instagram.com/p/XYZ/\n@panitia.acara\nSeminar besok\njam 8")
    assert link.endswith("/p/XYZ/") and akun == "@panitia.acara" and caption == "Seminar besok\njam 8"


def test_inbox_collector(db, png):
    from pesanin import config

    config.INBOX_DIR.mkdir(parents=True)
    (config.INBOX_DIR / "poster1.png").write_bytes(png)
    (config.INBOX_DIR / "poster1.txt").write_text("https://www.instagram.com/p/INBOX1/\nPengajian akbar", encoding="utf-8")
    (config.INBOX_DIR / "catatan.txt").write_text("Gathering kantor Jumat depan", encoding="utf-8")
    (config.INBOX_DIR / "rusak.jpg").write_bytes(b"bukan gambar")
    hasil = InboxCollector().jalankan(db)
    assert (hasil.baru, hasil.duplikat, len(hasil.galat)) == (2, 0, 1)
    assert (config.INBOX_DIR / "_selesai" / "poster1.png").exists()
    assert (config.INBOX_DIR / "_gagal" / "rusak.jpg").exists()
    posts = layanan.ambil_pending(db, 10)
    dengan_gambar = next(p for p in posts if p.path_gambar)
    assert dengan_gambar.permalink == "https://www.instagram.com/p/INBOX1/"
    assert layanan.path_gambar_absolut(dengan_gambar).exists()

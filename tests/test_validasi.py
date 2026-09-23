from datetime import timedelta

import pytest

from pesanin import normalisasi
from pesanin.config import hari_ini
from pesanin.validasi import HasilTidakValid, baca_json, validasi_hasil


def hasil_lengkap(**ubah):
    data = {
        "relevan": True,
        "skor": 8,
        "jenis_acara": "seminar",
        "alasan": "Seminar kampus 300 peserta.",
        "nama_acara": "Seminar Nasional Digitalpreneur 2026",
        "penyelenggara": "HIMA",
        "tanggal_acara": (hari_ini() + timedelta(days=60)).isoformat(),
        "lokasi": "Aula",
        "kota": "bandung",
        "perkiraan_peserta": 300,
        "kontak_ig": "@Hima.Contoh",
        "kontak_wa": "0812-0000-0101",
        "catatan": None,
        "draf_dm": "Halo Kak panitia Seminar Nasional Digitalpreneur 2026! Kami menawarkan paket ayam goreng.",
    }
    data.update(ubah)
    return data


def kesalahan(data, ambang=6):
    with pytest.raises(HasilTidakValid) as e:
        validasi_hasil(data, ambang)
    return "\n".join(e.value.kesalahan)


def test_hasil_lengkap_valid_dan_dinormalkan():
    bersih, peringatan = validasi_hasil(hasil_lengkap(), 6)
    assert bersih["kontak_wa"] == "6281200000101"
    assert bersih["kontak_ig"] == "hima.contoh"
    assert bersih["tanggal_acara"] == hari_ini() + timedelta(days=60)
    assert bersih["catatan_ai"] is None
    assert peringatan == []


def test_skor_rendah_cukup_kolom_dasar():
    bersih, _ = validasi_hasil({"relevan": False, "skor": 1, "jenis_acara": "kompetitor", "alasan": "Akun catering."}, 6)
    assert bersih["skor"] == 1 and bersih["draf_dm"] is None


def test_tipe_salah_ditolak():
    teks = kesalahan(hasil_lengkap(skor="8", relevan="true", perkiraan_peserta="300"))
    assert "skor" in teks and "relevan" in teks and "perkiraan_peserta" in teks


def test_skor_tinggi_wajib_semua_kolom():
    teks = kesalahan({"relevan": True, "skor": 7, "jenis_acara": "seminar", "alasan": "x"})
    assert "wajib ada" in teks and "draf_dm" in teks


def test_kolom_tak_dikenal_dan_isian_samaran():
    teks = kesalahan(hasil_lengkap(harga=15000, lokasi="-", penyelenggara=""))
    assert "harga" in teks and "lokasi" in teks and "penyelenggara" in teks


def test_kompetitor_tidak_boleh_skor_tinggi():
    teks = kesalahan(hasil_lengkap(jenis_acara="kompetitor"))
    assert "kompetitor" in teks


def test_relevan_false_dengan_skor_tinggi_ditolak():
    assert "relevan=false" in kesalahan(hasil_lengkap(relevan=False))


def test_placeholder_template_ditolak():
    teks = kesalahan(hasil_lengkap(draf_dm="Halo Kak, kami lihat {nama_acara} di {kota}, ada paket ayam goreng crispy."))
    assert "placeholder" in teks


def test_tanggal_dan_wa_tidak_valid():
    teks = kesalahan(hasil_lengkap(tanggal_acara="10/10/2026", kontak_wa="12345"))
    assert "tanggal_acara" in teks and "kontak_wa" in teks


def test_peringatan_nama_acara_tidak_disebut():
    _, peringatan = validasi_hasil(hasil_lengkap(draf_dm="Halo Kak, kami catering ayam goreng crispy di Bandung, minat?"), 6)
    assert any("nama acara" in p for p in peringatan)


def test_json_rusak():
    with pytest.raises(HasilTidakValid) as e:
        baca_json('{"skor": 8,}')
    assert "baris 1" in e.value.kesalahan[0]


@pytest.mark.parametrize(
    "masuk,keluar",
    [
        ("https://www.instagram.com/p/ABC123/?igsh=xyz", "https://www.instagram.com/p/ABC123/"),
        ("instagram.com/reel/ABC123", "https://www.instagram.com/p/ABC123/"),
        ("https://m.instagram.com/namaakun/p/ABC123/", "https://www.instagram.com/p/ABC123/"),
    ],
)
def test_normalisasi_permalink(masuk, keluar):
    assert normalisasi.permalink(masuk) == keluar


@pytest.mark.parametrize("masuk", ["0812-0000-0101", "+62 812 0000 0101", "812 0000 0101", "6281200000101"])
def test_normalisasi_wa(masuk):
    assert normalisasi.nomor_wa(masuk) == "6281200000101"

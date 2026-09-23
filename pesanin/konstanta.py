"""Daftar nilai tetap yang dipakai CLI, validasi, dan dashboard."""

STATUS = {
    "belum_diproses": "Belum diproses",
    "baru": "Baru",
    "sudah_dm": "Sudah DM",
    "nego": "Nego",
    "deal": "Deal",
    "tolak": "Tolak",
    "tidak_relevan": "Tidak relevan",
}
# Prospek yang masih perlu ditindaklanjuti.
STATUS_AKTIF = ("baru", "sudah_dm", "nego")
# Status yang berarti prospek sudah dihubungi (dipakai ringkasan & tanggal kontak).
STATUS_DIHUBUNGI = ("sudah_dm", "nego", "deal", "tolak")

JENIS_ACARA = {
    "seminar": "Seminar/Talkshow",
    "workshop": "Workshop/Pelatihan",
    "gathering_kantor": "Gathering kantor",
    "rapat": "Rapat/Raker",
    "ulang_tahun": "Ulang tahun",
    "acara_sekolah": "Acara sekolah",
    "wisuda": "Wisuda/Perpisahan",
    "pengajian": "Pengajian/Keagamaan",
    "acara_kampus": "Acara kampus",
    "pernikahan": "Pernikahan/Lamaran",
    "khitanan": "Khitanan/Aqiqah",
    "reuni": "Reuni/Arisan",
    "komunitas": "Acara komunitas",
    "olahraga": "Lomba/Olahraga",
    "bazar_festival": "Bazar/Festival",
    "sosial": "Bakti sosial",
    "lainnya": "Acara lainnya",
    "iklan_jualan": "Iklan jualan",
    "kompetitor": "Kompetitor (catering/makanan)",
    "bukan_acara": "Bukan acara",
}
# Jenis yang tidak pernah boleh jadi prospek.
JENIS_BUKAN_PROSPEK = ("iklan_jualan", "kompetitor", "bukan_acara")

KOTA = {
    "bandung": "Bandung Raya",
    "tasikmalaya": "Tasikmalaya",
    "garut": "Garut",
    "cirebon": "Cirebon",
    "pangandaran": "Pangandaran",
    "lainnya": "Di luar area",
}

SUMBER = {
    "manual": "Input manual",
    "inbox": "Folder inbox",
    "ig_hashtag": "Hashtag IG",
    "ig_akun": "Akun pantauan",
}

DEFAULT_PENGATURAN = {
    "ambang_skor": 6,
    "hari_mendesak": 3,
}

# Isi awal halaman Pengaturan; bebas diubah dari dashboard.
DEFAULT_HASHTAG = [
    "seminarbandung",
    "eventbandung",
    "infoeventbandung",
    "eventtasikmalaya",
    "infogarut",
    "eventcirebon",
    "infopangandaran",
    "wisudabandung",
]
DEFAULT_PENGECUALIAN = [
    "open reseller",
    "dropship",
    "giveaway",
    "lowongan kerja",
    "loker",
    "jastip",
]

# Batas Instagram Graph API: 30 hashtag unik per 7 hari (bergulir).
BATAS_HASHTAG_UNIK = 30
JENDELA_HASHTAG_HARI = 7

EKSTENSI_GAMBAR = (".jpg", ".jpeg", ".png", ".webp", ".gif")
MAKS_UKURAN_GAMBAR = 15 * 1024 * 1024

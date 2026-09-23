# Pesanin 🍗

Radar prospek untuk usaha catering ayam goreng tepung di **Bandung, Tasikmalaya, Garut, Cirebon,
dan Pangandaran**. Pesanin mengumpulkan postingan Instagram tentang acara yang kemungkinan butuh
konsumsi (seminar, gathering kantor, ulang tahun di sekolah, wisuda, pengajian, acara kampus, dll.),
lalu Claude Code menilai tiap postingan dan menyiapkan draf DM lewat skill `/radar`.

**Prinsip:**

- **DM dikirim manual oleh Anda.** Pesanin tidak pernah mengirim pesan, like, comment, atau follow.
- **Tanpa API key AI.** Aplikasi tidak memakai Anthropic API. Semua penilaian, pembacaan poster, dan
  penulisan draf DM dikerjakan Claude Code saat Anda menjalankan `/radar`.
- **Tanpa scraping.** Sumber data hanya input manual, folder `inbox/`, dan Instagram Graph API resmi (opsional).

## Isi proyek

```
Pesanin/
├── .claude/skills/radar/
│   ├── SKILL.md         # langkah kerja /radar
│   └── kriteria.md      # kriteria skor & template penawaran — EDIT file ini
├── pesanin/
│   ├── collectors/      # inbox, hashtag IG, akun pantauan IG
│   ├── web/             # dashboard (FastAPI + Tailwind)
│   ├── layanan.py       # simpan postingan, cegah duplikat, status, ringkasan
│   ├── validasi.py      # validasi ketat hasil /radar
│   └── models.py        # skema database SQLite
├── contoh/              # 8 data contoh fiktif + poster
├── manage.py            # CLI
├── inbox/               # taruh screenshot poster di sini
├── media/               # gambar poster yang tersimpan
└── data/pesanin.db      # database (dibuat otomatis)
```

## Instalasi

Butuh **Python 3.11+** dan [Claude Code](https://claude.com/claude-code).

```bash
git clone <url-repo> Pesanin
cd Pesanin
python -m venv .venv
# Windows:        .venv\Scripts\activate
# macOS / Linux:  source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env        # Windows: copy .env.example .env
```

File `.env` hanya dibutuhkan untuk Instagram Graph API dan boleh dibiarkan kosong.

## Menjalankan dashboard

```bash
python manage.py serve
```

Buka **http://127.0.0.1:8000**. Dashboard hanya bisa diakses dari laptop itu sendiri (tanpa login).
Tampilan memakai Tailwind dari CDN, jadi laptop perlu terhubung ke internet.

Halaman yang tersedia:

| Halaman | Isi |
|---|---|
| **Prospek** | Daftar prospek, default urut acara terdekat yang belum lewat lalu skor. Kartu bergaris **merah** jika acara kurang dari 3 hari lagi. Filter status, jenis acara, kota, rentang tanggal, skor minimum, dan pencarian. Tombol **Salin draf DM**, **Buka WhatsApp** (wa.me dengan pesan terisi), **Buka postingan**, dan pilihan status langsung di kartu. |
| **Detail** (klik judul) | Poster, caption, alasan skor, draf DM yang bisa diedit, status, tanggal terakhir dihubungi, catatan, koreksi data acara, riwayat status. |
| **Tambah** | Tempel link + caption dan/atau unggah poster. |
| **Ringkasan** | Prospek baru, DM terkirim, dan deal per minggu, tingkat deal, dan rekap per kota. |
| **Pengaturan** | Ambang skor, batas hari "mendesak", daftar hashtag, akun pantauan, kata pengecualian, status token Graph API. |

Alur status: **Belum diproses → Baru → Sudah DM → Nego → Deal / Tolak / Tidak relevan**.
Saat status diubah ke Sudah DM/Nego/Deal/Tolak, *terakhir dihubungi* otomatis diisi hari ini (bisa diubah).

### Coba dengan data contoh

```bash
python manage.py seed-contoh     # 7 postingan + 1 poster di inbox/
```

Lalu jalankan `/radar` (lihat di bawah). Data contoh bisa dihapus dengan `python manage.py hapus-contoh`.
Semua nama, akun, dan nomor di data contoh **fiktif**, jadi jangan dihubungi.

## Memasukkan postingan

1. **Form Tambah** di dashboard: link postingan, akun pengunggah, caption, dan/atau gambar poster.
2. **Folder `inbox/`**: taruh screenshot poster (JPG/PNG/WEBP/GIF). Jika ada link atau caption, simpan
   di file `.txt` dengan nama yang sama, misalnya `poster1.jpg` + `poster1.txt`:
   ```
   https://www.instagram.com/p/ABC123/
   @akunpanitia
   Caption postingan di sini...
   ```
   File diambil saat `collect` dijalankan (atau tombol **Kumpulkan**), lalu dipindah ke `inbox/_selesai/`
   (duplikat ke `_duplikat/`, file rusak ke `_gagal/`).
3. **Terminal**: `python manage.py tambah --link URL --caption "..." --gambar poster.jpg`
4. **Instagram Graph API** (opsional, lihat bagian terakhir).

Duplikat dicegah berdasarkan permalink (link `/p/`, `/reel/`, dan parameter `?igsh=` dianggap sama)
atau gambar yang identik.

## Memakai `/radar`

1. Buka terminal di folder proyek (virtualenv aktif), lalu jalankan `claude`.
2. Ketik **`/radar`**, atau `/radar 50` untuk memproses sampai 50 postingan sekaligus (default 20).

Claude Code akan:

1. menjalankan `python manage.py collect`;
2. mengambil antrean `python manage.py pending --limit 20`;
3. membaca caption dan **melihat gambar poster** tiap postingan;
4. menilai: relevan, skor 1–10, jenis acara, alasan. Iklan jualan dan akun catering/makanan
   (kompetitor) diberi skor rendah, begitu juga acara online, acara yang sudah lewat, dan acara di luar 5 kota;
5. untuk skor ≥ ambang (default 6): mengekstrak nama acara, penyelenggara, tanggal, lokasi, kota,
   perkiraan peserta, kontak IG/WA, catatan, lalu menulis draf DM;
6. menyimpan tiap hasil lewat `save-result` (ditolak dan diperbaiki jika formatnya salah);
7. menampilkan ringkasan: jumlah diproses, jumlah prospek bagus, dan 5 prospek dengan acara terdekat.

Setelah itu buka dashboard, salin draf DM atau buka WhatsApp, kirim sendiri, lalu ubah statusnya.

**Menyesuaikan penilaian dan penawaran:** edit `.claude/skills/radar/kriteria.md`. Di situ ada nama
usaha (`[Nama Usaha]`) dan nomor WA (`[No. WA]`) yang perlu Anda ganti, harga (mulai Rp15.000/box),
minimal order (20 box), radius gratis antar (10 km), wilayah layanan, skala skor, dan template DM.
Ambang skor dan batas hari mendesak diubah di halaman **Pengaturan**.

## Perintah CLI

| Perintah | Fungsi |
|---|---|
| `python manage.py collect` | Jalankan semua collector yang aktif (`--hanya inbox` untuk satu saja) |
| `python manage.py pending --limit 20` | JSON postingan berstatus belum diproses (id, caption, permalink, path gambar) |
| `python manage.py save-result <id> --json '<hasil>'` | Validasi & simpan hasil analisis. Juga bisa `--json -` (stdin) atau `--file hasil.json`; `--timpa` untuk menimpa |
| `python manage.py stats` | Ringkasan singkat (`--json` untuk keluaran JSON) |
| `python manage.py skema` | Format JSON hasil dan nilai `jenis_acara`/`kota` yang diizinkan |
| `python manage.py tambah ...` | Tambah postingan dari terminal |
| `python manage.py seed-contoh` / `hapus-contoh` | Masukkan / hapus data contoh |
| `python manage.py serve` | Jalankan dashboard (`--port`, `--reload`) |

Contoh pesan galat `save-result` (tidak ada yang tersimpan sampai semuanya benar):

```
GAGAL: hasil untuk postingan #1 tidak valid, belum disimpan:
  - skor: harus angka bulat 1-10 tanpa tanda kutip, diterima teks '8'.
  - tanggal_acara: '10/10/2026' bukan tanggal ISO yang valid. Contoh: '2026-10-17'.
```

## Instagram Graph API (opsional)

Tanpa token, Pesanin tetap berjalan dengan input manual dan `inbox/`. Jika token diisi, dua collector aktif:

- **Hashtag Search**: postingan **24 jam terakhir** dari tiap hashtag di Pengaturan. Instagram membatasi
  **30 hashtag unik per 7 hari**; Pesanin mencatat pemakaiannya dan melewati hashtag baru jika batas tercapai.
  Karena hanya 24 jam terakhir, jalankan `collect`/`/radar` minimal sekali sehari.
- **Business Discovery**: postingan terbaru (30 hari) dari akun pantauan, misalnya akun info event kota,
  BEM kampus, atau EO. Hanya bisa membaca akun **Bisnis/Kreator**, bukan akun pribadi.

### Garis besar mendapatkan token

Nama menu di Meta sering berubah, jadi ikuti dokumentasi resmi Meta untuk detailnya.

1. **Siapkan akun.** Ubah akun Instagram usaha Anda menjadi akun **Bisnis** atau **Kreator**, lalu
   hubungkan ke sebuah **Halaman Facebook** (Pengaturan Instagram → Akun → Pusat Akun / Halaman terhubung).
2. **Buat aplikasi Meta** di [developers.facebook.com](https://developers.facebook.com) → *My Apps* →
   *Create App* (tipe *Business*). Tambahkan produk **Instagram** dengan opsi *API setup with Facebook Login*.
3. **Izin yang dibutuhkan:** `instagram_basic`, `pages_show_list`, `pages_read_engagement`
   (dan `business_management` jika halaman dikelola lewat Business Manager). Hashtag Search juga butuh
   fitur **Instagram Public Content Access**, yang umumnya harus lolos **App Review** Meta.
   Business Discovery biasanya sudah bisa dipakai oleh admin aplikasi dalam mode pengembangan.
4. **Buat token** lewat [Graph API Explorer](https://developers.facebook.com/tools/explorer/):
   pilih aplikasi Anda → *Generate Access Token* dengan izin di atas. Token ini berlaku ±1 jam, jadi
   tukar menjadi **long-lived token (±60 hari)**:
   ```
   GET https://graph.facebook.com/v23.0/oauth/access_token
       ?grant_type=fb_exchange_token&client_id=APP_ID&client_secret=APP_SECRET
       &fb_exchange_token=TOKEN_PENDEK
   ```
   Alternatif yang tidak kedaluwarsa: token **System User** dari Meta Business Settings.
5. **Cari IG_USER_ID** (ID akun Instagram Bisnis Anda, berupa angka):
   ```
   GET https://graph.facebook.com/v23.0/me/accounts?access_token=TOKEN
   GET https://graph.facebook.com/v23.0/{PAGE_ID}?fields=instagram_business_account&access_token=TOKEN
   ```
6. **Isi `.env`** lalu jalankan ulang dashboard:
   ```
   IG_ACCESS_TOKEN=token_panjang_anda
   IG_USER_ID=17841400000000000
   GRAPH_API_VERSION=v23.0
   ```
   Halaman **Pengaturan** akan menampilkan status *Aktif*. Jika token kedaluwarsa, `collect` akan
   menampilkan pesan "Token tidak valid atau kedaluwarsa". Buat token baru dan perbarui `.env`.

File `.env` berisi rahasia dan sudah dikecualikan dari git. Jangan dibagikan.

## Pengembangan

```bash
pip install -r requirements-dev.txt
python -m pytest
```

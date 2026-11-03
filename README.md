# Jadwalin

PWA (bisa di-install) untuk mencatat dan memantau agenda kegiatan toko: yang **akan dilaksanakan** dan yang **sudah dilaksanakan**. Bergaya playful, bubbly, dan soft minimalism, dengan tata letak yang menyesuaikan HP, tablet, dan PC.

## Fitur

- **Halaman utama** hanya berisi kalender dan *Perlu update*.
- **Kalender kegiatan**: minggu dimulai hari **Minggu** (tanggal 1 diletakkan di bawah nama harinya). Tampilan *Bulan* atau *Minggu* (judulnya *Minggu 1, 2, …*). Di HP tiap tanggal diberi maksimal 3 tanda: jenis kegiatan yang berbeda didahulukan, dan jika lebih dari 3 kegiatan tanda ketiga menjadi `+N`. Di tablet/PC nama kegiatannya tertulis di kotak tanggal.
- **Ketuk tanggal** → pop up berisi kegiatan di tanggal itu (jenis, nama, toko), dengan tombol ke *Daftar kegiatan*.
- **Daftar kegiatan** (tombol di bawah kalender atau di pop up tanggal): semua kegiatan sebulan, dibagi Akan dilaksanakan / Sudah dilaksanakan, dengan tombol ‹ › untuk pindah bulan. Tombol kembali membawa ke tampilan sebelumnya (detail → daftar → pop up tanggal).
- **Perlu update**: kegiatan yang sudah lewat tapi masih Terjadwal, dengan tombol ✓ (selesai) dan ✕ (batal) langsung di baris. Kartunya hilang sendiri jika semua sudah diupdate.
- **Tambah & ubah kegiatan** lewat tombol **+ Tambah**: tanggalnya mengikuti tanggal yang terakhir diketuk di kalender. Form dari bawah layar (HP) atau jendela di tengah (tablet/PC); 5 jenis kegiatan tampil dalam satu baris. Jika nama belum diisi, pengguna diminta mengisi nama dulu. Nama PIC yang pernah dicatat muncul sebagai saran, dan nomornya terisi otomatis.
- **Detail kegiatan**: ganti status (Terjadwal / Selesai / Batal), ketuk Nomor PIC untuk chat WhatsApp (wa.me), bagikan ke WhatsApp, ubah, atau hapus (dengan konfirmasi; data dipindah ke sheet `Sampah`).
- **Cari**: tekan tombol cari, kotak pencarian dan hasilnya muncul melayang di bawah tombol. **Filter**: regional, area, toko, jenis kegiatan, pencatat.
- **Pengaturan**: nama, tema (Terang / Gelap / Otomatis), warna (Mint / Lavender / Peach), regional yang ditampilkan, info data & muat ulang, install (disembunyikan jika aplikasi sudah terpasang), bersihkan cache.
- Bisa dibuka tanpa internet (data terakhir tetap tampil). Shortcut ikon aplikasi: *Tambah kegiatan* dan *Kegiatan bulan ini*.

## Spreadsheet

| Sheet | Isi |
|---|---|
| `Data` | Data kegiatan. `Nama` = orang yang menginput kegiatan (tampil sebagai *Dicatat oleh*); `Nama PIC` & `Nomor PIC` = penanggung jawab acara (pihak TK/komunitas/event), bukan penginput. Kolom dibaca berdasarkan **nama header** (urutan bebas). Kolom yang belum ada ditambahkan otomatis di ujung kanan: `ID`, `Tanggal`, `Nama`, `Nama Toko`, `Kegiatan`, `Keterangan 1`, `Keterangan 2`, `Nama PIC`, `Nomor PIC`, `Keterangan`, `Status`, `Dibuat`, `Diubah`. Kolom lain milik Anda tidak disentuh. |
| `Daftar Toko` | Acuan nama toko & filter. Header yang dikenali: `Nama Toko` (atau `Toko` / `Nama Store` / `Store` / `Cabang`), `Regional`, `Area`. Sheet ini hanya dibaca. |
| `Kontak` | Dibuat otomatis. Daftar PIC: `Nama PIC`, `Nomor PIC`, `Toko`, `Dibuat`, `Diubah`. Setiap kegiatan yang disimpan dengan Nama PIC menambah/memperbarui barisnya (nama sama = baris sama). Saat pertama dibuat, isinya diambil dari PIC yang sudah ada di sheet `Data`. |
| `Sampah` | Dibuat otomatis. Kegiatan yang dihapus dari aplikasi dipindah ke sini, ditambah kolom `Dihapus` (waktu) dan `Dihapus oleh`. Untuk memulihkan, salin barisnya kembali ke `Data`. |

Isian per jenis kegiatan (`Keterangan 1` / `Keterangan 2`):

| Kegiatan | Keterangan 1 | Keterangan 2 | PIC & Keterangan |
|---|---|---|---|
| FLD | Nama TK (wajib) | Jumlah peserta | opsional |
| GCOM | Nama komunitas (wajib) | Jumlah peserta | opsional |
| CX | Tujuan kunjungan (wajib) | — | opsional |
| Support Event | Nama Event (wajib) | Support (wajib) | opsional |
| Lain-lain | Keterangan (wajib) | — | Nama & Nomor PIC opsional |

Catatan:
- Baris lama yang belum punya `ID` otomatis diberi ID saat data dimuat (ID dipakai untuk ubah & hapus).
- `Status` kosong dianggap `Terjadwal`.
- `Tanggal` dan `Nomor PIC` disimpan sebagai teks agar tidak diubah format oleh Sheets (nol di depan nomor tetap ada).

## Setup Apps Script

Lakukan setiap kali `apps-script/Code.gs` berubah (versi 2.1–2.2 menambah kolom PIC, sheet `Kontak`, dan sheet `Sampah`):

1. Buka spreadsheet → **Extensions → Apps Script**.
2. Ganti seluruh isi `Code.gs` dengan isi file [`apps-script/Code.gs`](apps-script/Code.gs), lalu simpan.
3. **Deploy → Manage deployments** → pilih deployment yang URL-nya sudah dipakai (`…AKfycbwN3F16…/exec`) → ikon pensil (**Edit**) → **Version: New version** → **Deploy**.
   Dengan cara ini URL tetap sama, jadi `js/config.js` tidak perlu diubah.
   (Jika membuat deployment baru: *Execute as: Me*, *Who has access: Anyone*, lalu salin URL baru ke `APPS_SCRIPT_URL` di `js/config.js`.)
4. Setujui izin akses spreadsheet saat diminta.

Jika aplikasi menampilkan "Apps Script belum versi Jadwalin", langkah 2–3 belum dilakukan. Jika tombol hapus menampilkan "Fitur hapus butuh Apps Script terbaru", deploy ulang versi baru.

## Hosting & install

Aplikasi berupa file statis. Cara termudah: **GitHub Pages** (Settings → Pages → Deploy from branch → `main` / root). PWA butuh HTTPS; GitHub Pages sudah HTTPS.

Install di perangkat:
- **Android / Chrome / Edge**: Pengaturan → tombol **Install**, atau menu browser → *Install app*.
- **iPhone / iPad**: buka di Safari → tombol **Bagikan** → **Tambah ke Layar Utama**.

## Struktur

```
index.html            halaman utama
manifest.json         manifest PWA
service-worker.js     cache offline (app + font)
css/style.css         gaya & token warna (palet Mint/Lavender/Peach, terang/gelap)
js/config.js          URL Apps Script, jenis kegiatan, status, palet
js/sheets.js          komunikasi dengan Apps Script + cache
js/app.js             logika aplikasi
icons/                logo & ikon aplikasi
apps-script/Code.gs   backend Google Apps Script
```

## Mengubah tampilan

- **Warna palet**: token ada di `css/style.css` (`:root` untuk Mint, `[data-palette="lavender"]`, `[data-palette="peach"]`). Daftar nama palet dan warna bilah status HP ada di `PALETTES` di `js/config.js`.
- **Jenis kegiatan**: `ACTIVITY_TYPES` di `js/config.js` (nama, ikon, isian). Warnanya mengacu ke token `--fld`, `--gcom`, `--cx`, `--se`, `--lain` di CSS; ikonnya simbol `#i-kid`, `#i-people`, `#i-star`, `#i-handshake`, `#i-clipboard` di `index.html`.
- **Logo**: ganti `icons/logo.svg`, `icons/icon.svg`, `icons/icon-maskable.svg`, dan PNG turunannya (`icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, `apple-touch-icon.png`) dengan nama file yang sama. Logo di dalam aplikasi ada di simbol `#i-logo` di `index.html`.
- Setiap rilis: naikkan `CACHE_NAME` di `service-worker.js` dan `APP_VERSION` di `js/config.js` agar perangkat yang sudah install mendapat versi baru.

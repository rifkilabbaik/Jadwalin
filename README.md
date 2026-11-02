# Jadwalin

PWA (bisa di-install) untuk mencatat dan memantau agenda kegiatan toko: yang **akan dilaksanakan** dan yang **sudah dilaksanakan**. Versi 2 bergaya playful, bubbly, dan soft minimalism, dengan tata letak yang menyesuaikan HP, tablet, dan PC.

## Fitur

- **Satu layar Agenda**: ringkasan (hari ini, minggu ini, perlu update, selesai bulan ini), kalender, dan daftar kegiatan.
- **Kalender kegiatan**: tampilan Bulan atau Minggu. Di HP tiap tanggal diberi titik warna per jenis kegiatan; di tablet/PC nama kegiatannya langsung tertulis di kotak tanggal. Ketuk tanggal untuk melihat kegiatannya.
- **Daftar kegiatan**: pilih *Tanggal* (kegiatan di tanggal terpilih + yang akan datang) atau *Sebulan* (semua kegiatan di bulan yang dilihat, dibagi Akan dilaksanakan / Sudah dilaksanakan).
- **Perlu update**: kegiatan yang sudah lewat tapi masih Terjadwal, dengan tombol ✓ (selesai) dan ✕ (batal) langsung di baris.
- **Tambah & ubah kegiatan**: form dari bawah layar (HP) atau jendela di tengah (tablet/PC). Jenis kegiatan dan tanggal dipilih sekali ketuk; nama pencatat diambil dari Pengaturan.
- **Detail kegiatan**: ganti status (Terjadwal / Selesai / Batal), bagikan ke WhatsApp, ubah, atau hapus (dengan konfirmasi).
- **Cari** (nama kegiatan, toko, PIC) dan **filter** (regional, area, toko, jenis kegiatan, PIC).
- **Pengaturan**: nama, tema (Terang / Gelap / Otomatis), warna (Mint / Lavender / Peach), regional yang ditampilkan, info data & muat ulang, install, bersihkan cache.
- Bisa dibuka tanpa internet (data terakhir tetap tampil). Shortcut ikon aplikasi: *Tambah kegiatan* dan *Kegiatan bulan ini*.

## Spreadsheet

| Sheet | Isi |
|---|---|
| `Data` | Data kegiatan. Kolom dibaca berdasarkan **nama header** (urutan bebas). Kolom yang belum ada ditambahkan otomatis di ujung kanan: `ID`, `Tanggal`, `Nama`, `Nama Toko`, `Kegiatan`, `Keterangan 1`, `Keterangan 2`, `Status`, `Dibuat`, `Diubah`. Kolom lain milik Anda tidak disentuh. |
| `Daftar Toko` | Acuan nama toko & filter. Header yang dikenali: `Nama Toko` (atau `Toko` / `Nama Store` / `Store` / `Cabang`), `Regional`, `Area`. Sheet ini hanya dibaca. |

Catatan:
- `Keterangan 1/2` mengikuti jenis kegiatan: FLD → Nama TK & Jumlah Peserta, GCOM → Nama Komunitas & Jumlah Peserta, CX → Tujuan Kunjungan. Jumlah Peserta boleh dikosongkan dulu.
- Baris lama yang belum punya `ID` otomatis diberi ID saat data dimuat (ID dipakai untuk ubah & hapus).
- `Status` kosong dianggap `Terjadwal`. Menghapus kegiatan menghapus barisnya dari sheet `Data`.

## Setup Apps Script

Lakukan setiap kali `apps-script/Code.gs` berubah (versi 2 menambah aksi hapus):

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
- **Jenis kegiatan**: `ACTIVITY_TYPES` di `js/config.js` (nama, ikon, isian). Warnanya mengacu ke token `--fld`, `--gcom`, `--cx` di CSS.
- **Logo**: ganti `icons/logo.svg`, `icons/icon.svg`, `icons/icon-maskable.svg`, dan PNG turunannya (`icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, `apple-touch-icon.png`) dengan nama file yang sama. Logo di dalam aplikasi ada di simbol `#i-logo` di `index.html`.
- Setiap rilis: naikkan `CACHE_NAME` di `service-worker.js` dan `APP_VERSION` di `js/config.js` agar perangkat yang sudah install mendapat versi baru.

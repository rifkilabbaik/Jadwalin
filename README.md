# Jadwalin

PWA (bisa di-install) untuk mencatat dan memantau agenda kegiatan toko: yang **akan dilaksanakan** dan yang **sudah dilaksanakan**. Desain mengikuti Rekapin v2.

## Fitur

1. **Kalender Kegiatan** — kalender bulanan; setiap tanggal yang ada kegiatannya diberi tanda sesuai jenis kegiatan (FLD / GCOM / CX, angka = jumlah). Hari ini diberi bingkai. Ketuk tanggal untuk melihat kegiatan di tanggal itu atau menambah kegiatan di tanggal tersebut.
2. **Daftar Kegiatan** — semua kegiatan di bulan berjalan, dibagi *Akan dilaksanakan* dan *Sudah dilaksanakan*. Kartu ringkasan menunjukkan jumlahnya, termasuk kegiatan lampau yang statusnya belum dikonfirmasi.
3. **Tambah & Ubah Kegiatan** — form tambah; ketuk kegiatan mana saja (di daftar atau kalender) untuk mengubahnya, termasuk status **Terjadwal / Selesai / Batal**.

Tambahan: filter (bulan, regional, area, toko, kegiatan, nama) di tombol kanan atas, pengaturan tema/bahasa/huruf, pembatasan regional, cache offline (data terakhir tetap tampil tanpa internet), tombol install, dan shortcut ikon aplikasi (*Tambah kegiatan*, *Daftar kegiatan*).

## Spreadsheet

| Sheet | Isi |
|---|---|
| `Data` | Data kegiatan. Kolom dibaca berdasarkan **nama header** (urutan bebas). Kolom yang belum ada akan ditambahkan otomatis di ujung kanan: `ID`, `Tanggal`, `Nama`, `Nama Toko`, `Kegiatan`, `Keterangan 1`, `Keterangan 2`, `Status`, `Dibuat`, `Diubah`. Kolom lain milik Anda tidak disentuh. |
| `Daftar Toko` | Acuan nama toko & filter. Header yang dikenali: `Nama Toko` (atau `Toko` / `Nama Store` / `Store` / `Cabang`), `Regional`, `Area`. Sheet ini hanya dibaca. |

Catatan:
- `Keterangan 1/2` mengikuti jenis kegiatan (sama seperti Rekapin): FLD → Nama TK & Jumlah Peserta, GCOM → Nama Komunitas & Jumlah Peserta, CX → Tujuan Kunjungan. Jumlah Peserta boleh dikosongkan dulu dan diisi saat kegiatan selesai.
- Baris lama yang belum punya `ID` akan otomatis diberi ID saat data pertama kali dimuat (ID dipakai untuk fitur ubah).
- `Status` kosong dianggap `Terjadwal`.

## Setup Apps Script (wajib, sekali saja)

1. Buka spreadsheet → **Extensions → Apps Script**.
2. Ganti seluruh isi `Code.gs` dengan isi file [`apps-script/Code.gs`](apps-script/Code.gs), lalu simpan.
3. **Deploy → Manage deployments** → pilih deployment yang URL-nya sudah dipakai (`…AKfycbwN3F16…/exec`) → ikon pensil (**Edit**) → **Version: New version** → **Deploy**.
   Dengan cara ini URL tetap sama, jadi `js/config.js` tidak perlu diubah.
   (Jika membuat deployment baru: *Execute as: Me*, *Who has access: Anyone*, lalu salin URL baru ke `APPS_SCRIPT_URL` di `js/config.js`.)
4. Setujui izin akses spreadsheet saat diminta.

Jika aplikasi menampilkan "Apps Script belum versi Jadwalin", berarti langkah 2–3 belum dilakukan.

## Hosting & install

Aplikasi berupa file statis. Cara termudah: **GitHub Pages** (Settings → Pages → Deploy from branch → `main` / root). PWA butuh HTTPS; GitHub Pages sudah HTTPS.

Install di perangkat:
- **Android / Chrome / Edge desktop**: buka URL → tombol **Install aplikasi** di menu samping (atau menu browser → *Install app*).
- **iPhone / iPad**: buka di Safari → tombol **Bagikan** → **Tambah ke Layar Utama**.

## Struktur

```
index.html            halaman utama
manifest.json         manifest PWA
service-worker.js     cache offline
css/style.css         gaya (diturunkan dari Rekapin v2)
js/config.js          URL Apps Script, jenis kegiatan, status, palet, teks
js/sheets.js          komunikasi dengan Apps Script + cache
js/app.js             logika aplikasi
icons/                logo & ikon (sementara)
apps-script/Code.gs   backend Google Apps Script
```

## Mengganti logo & palet warna

- **Logo**: ganti `icons/logo.svg`, `icons/icon.svg`, `icons/icon-maskable.svg`, dan PNG turunannya (`icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, `apple-touch-icon.png`) dengan nama file yang sama.
- **Palet**: ubah/ tambah entri `PALETTES` di `js/config.js` (palet pertama `krem_biru` adalah bawaan). Sesuaikan juga `theme_color`/`background_color` di `manifest.json` dan `meta theme-color` di `index.html`.
- Setiap rilis perubahan: naikkan `CACHE_NAME` di `service-worker.js` (mis. `jadwalin-v2`) dan `APP_VERSION` di `js/config.js` agar perangkat yang sudah install mendapat versi baru.

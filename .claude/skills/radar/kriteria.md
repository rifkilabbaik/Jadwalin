# Kriteria penilaian & template penawaran

File ini boleh diedit bebas. `/radar` membacanya setiap kali dijalankan.

> **Ambang skor prospek** (default 6) dan **batas hari mendesak** (default 3) diatur di
> dashboard → **Pengaturan**, karena dipakai juga oleh aplikasi untuk menentukan status.

## Profil usaha

Ganti isian dalam kurung siku dengan data Anda.

- Nama usaha: **[Nama Usaha]**
- WhatsApp: **[No. WA]**
- Produk: paket **ayam goreng crispy + nasi + minum**
- Harga: **mulai Rp15.000/box**
- Minimal order: **20 box**
- Gratis antar: **radius 10 km** dari dapur terdekat
- Dapur: Bandung, Tasikmalaya, Garut, Cirebon, Pangandaran

## Wilayah layanan (kolom `kota`)

| kota          | cakupan                                                  |
|---------------|----------------------------------------------------------|
| `bandung`     | Kota Bandung, Kab. Bandung, Kota Cimahi, Kab. Bandung Barat |
| `tasikmalaya` | Kota dan Kab. Tasikmalaya                                |
| `garut`       | Kab. Garut                                               |
| `cirebon`     | Kota dan Kab. Cirebon                                    |
| `pangandaran` | Kab. Pangandaran                                         |
| `lainnya`     | di luar semua daerah di atas                             |

Jika lokasi sama sekali tidak disebut, isi `kota: null` (jangan menebak) dan kurangi skor 1.

## Skala skor

| Skor | Arti |
|------|------|
| 9-10 | Acara tatap muka di wilayah layanan yang **jelas butuh konsumsi** (menyebut makan siang/snack/konsumsi/nasi kotak, atau panitia mencari vendor konsumsi), peserta ≥ 50, ada kontak panitia, dan masih ada waktu untuk memesan. |
| 7-8  | Acara tatap muka di wilayah layanan yang kemungkinan besar butuh konsumsi, tetapi sebagian info kurang (peserta, kontak, atau tanggal), atau skalanya 20-50 orang. |
| 5-6  | Mungkin butuh konsumsi tetapi samar: info minim, skala kecil (< 20 porsi), atau tidak jelas apakah konsumsi disediakan. |
| 3-4  | Acara nyata tetapi sulit dilayani: di luar wilayah, konsumsi sudah ditangani sponsor/catering lain, atau waktunya terlalu mepet tanpa tanda panitia masih mencari vendor. |
| 1-2  | Bukan prospek: iklan jualan, akun catering/kuliner lain (kompetitor), acara online, acara yang sudah selesai, giveaway, lowongan kerja, postingan pribadi. |

**Acara mendesak** (kurang dari batas hari mendesak) tetap boleh diberi skor tinggi jika panitia jelas
masih mencari vendor konsumsi. Tulis "MENDESAK" di awal `catatan`.

## Sinyal positif

- Kata kunci: "makan siang", "snack", "konsumsi", "coffee break", "free lunch", "nasi kotak",
  "nasi box", "open vendor", "mencari catering", "HTM sudah termasuk makan".
- Penyelenggara institusi: kantor/perusahaan, instansi, sekolah, TK, kampus/himpunan, DKM/majelis taklim,
  komunitas besar, EO.
- Jumlah peserta disebut dan ≥ 50.
- Ada CP/WA/DM panitia.

## Sinyal negatif

- Akun usaha makanan, catering/katering, nasi box, frozen food, kue, kedai → `jenis_acara: "kompetitor"`, skor 1.
- Promo produk atau jasa apa pun, walau memakai hashtag acara → `jenis_acara: "iklan_jualan"`, skor 1.
- Acara online (webinar, Zoom, Google Meet, live IG/YouTube) → skor 1-2, `relevan: false`.
- Acara yang sudah lewat dibanding `hari_ini` (recap, "kemarin", "alhamdulillah sukses") → skor 1-2, `relevan: false`.
- Lokasi di luar wilayah layanan → `kota: "lainnya"`, skor maksimal 3, `relevan: false`.
- Sudah menyebut sponsor atau vendor catering lain → skor maksimal 4.

## Menentukan `relevan`

`relevan: true` artinya acara ini kemungkinan butuh konsumsi **dan** bisa kita layani (tatap muka, di
wilayah layanan, belum lewat). Jika ragu, pilih `false`. Skor ≥ ambang wajib `relevan: true`.

## Aturan ekstraksi

- **nama_acara**: nama resmi acara seperti tertulis di poster/caption, tanpa emoji.
- **penyelenggara**: lembaga/panitia pelaksana, bukan akun info yang sekadar me-repost.
- **tanggal_acara**: tanggal pelaksanaan, bukan tanggal posting. Jika tahun tidak disebut, ambil tanggal
  terdekat setelah `tanggal_posting`. Tanggal relatif ("Sabtu ini", "besok") dihitung dari `tanggal_posting`.
  Acara beberapa hari → tanggal hari pertama, rentangnya ditulis di `catatan`. Tidak jelas → `null`.
- **lokasi**: nama tempat + alamat singkat.
- **perkiraan_peserta**: angka dari caption/poster ("kuota 300", "±500 jamaah", "45 siswa & guru").
  Rentang → nilai tengah. Tidak disebut → `null` (taksiran boleh ditulis di `catatan`).
- **kontak_wa**: nomor dari "CP/WA/Info/Konfirmasi". Jika lebih dari satu, pilih yang terkait panitia
  atau konsumsi; nomor lainnya tulis di `catatan`.
- **kontak_ig**: akun penyelenggara. Biasanya `akun_ig` pengunggah jika itu akun panitia/lembaga; jika
  pengunggah hanya akun info kota, pakai akun penyelenggara yang disebut, atau `null`.
- **catatan**: info yang berguna saat follow-up: jam acara, sesi makan, HTM, nama CP, "open vendor",
  kebutuhan khusus (mis. nasi kotak untuk anak), dan hal yang meragukan.

## Gaya draf DM

- Bahasa Indonesia santai-profesional. Sapa "Kak"; untuk sekolah atau instansi pakai "Bapak/Ibu".
  Untuk acara keagamaan Islam, buka dengan "Assalamu'alaikum".
- Sebut **nama acara persis** seperti di kolom `nama_acara`, beserta tanggalnya jika ada.
- 3-5 kalimat, maksimal ±600 karakter, maksimal 2 emoji. Tanpa huruf kapital berlebihan.
- Tawarkan: paket ayam goreng crispy + nasi + minum **mulai Rp15.000/box**, **min. order 20 box**,
  **gratis antar radius 10 km** dari dapur kami di kota acara.
- Tutup dengan pertanyaan ringan (menawarkan kirim daftar menu), bukan desakan.
- Tulis tanda tangan "[Nama Usaha]" dan "WA [No. WA]" persis seperti di bagian Profil usaha.
- Jangan menjanjikan diskon, menyebut kompetitor, atau mengklaim hal yang tidak ada di file ini.

## Template penawaran

Isi semua bagian `{...}` (validator menolak draf yang masih berisi kurung kurawal). Sesuaikan
sapaan dan kalimat agar terasa ditulis manusia, bukan hasil copy-paste.

```
Halo Kak, salam kenal! Kami [Nama Usaha], catering ayam goreng crispy dengan dapur di {kota}.
Kami lihat info {nama_acara} pada {hari, tanggal}. Kalau konsumsinya belum ada yang pegang,
kami ada paket ayam goreng crispy + nasi + minum mulai Rp15.000/box (min. 20 box), gratis antar
radius 10 km. Boleh kami kirim daftar menunya, Kak? 🙏
[Nama Usaha] – WA [No. WA]
```

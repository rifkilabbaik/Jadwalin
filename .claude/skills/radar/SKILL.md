---
name: radar
description: Proses postingan Instagram yang dikumpulkan Pesanin menjadi prospek catering. Menjalankan collector, menilai tiap postingan (caption dan poster), mengekstrak detail acara, menulis draf DM, menyimpan hasil lewat manage.py, lalu menampilkan ringkasan. Pakai saat pengguna mengetik /radar atau meminta memproses/menilai postingan baru di Pesanin.
argument-hint: "[jumlah maksimal postingan, default 20]"
---

# /radar: radar prospek catering

Kamu menilai postingan Instagram untuk usaha catering ayam goreng tepung di Bandung,
Tasikmalaya, Garut, Cirebon, dan Pangandaran. Tujuannya menemukan acara yang kemungkinan
butuh konsumsi, lalu menyiapkan draf DM yang nanti dikirim **manual** oleh pemilik usaha.
Aplikasi Pesanin hanya menyimpan data; semua penilaian dilakukan olehmu.

## Aturan keras

- **Jangan** mengirim DM, membuka, login, atau berinteraksi dengan Instagram/WhatsApp dengan cara apa pun.
- **Jangan** memakai API/SDK Anthropic atau layanan AI lain, dan jangan mencari data di internet untuk tugas ini.
- Hanya gunakan informasi dari caption, gambar poster, dan metadata postingan. Jangan mengarang
  kontak, tanggal, lokasi, atau jumlah peserta; isi `null` jika tidak ada.
- Simpan hasil **hanya** lewat `python manage.py save-result`. Jangan mengubah database secara langsung.

## Persiapan

- Jalankan semua perintah dari folder root proyek (yang berisi `manage.py`).
- Jika ada virtualenv `.venv`, pakai python dari situ (`.venv/bin/python`, atau `.venv\Scripts\python.exe`
  di Windows). Jika perintah `python` tidak ada, pakai `python3`.
- Baca [kriteria.md](kriteria.md) sekali di awal. File itu sumber kebenaran untuk wilayah layanan,
  skala skor, aturan ekstraksi, dan template penawaran. Ikuti isinya walau berbeda dengan contoh di sini.
- Jumlah maksimal postingan: pakai `$ARGUMENTS` jika berupa angka, selain itu 20.

## Langkah

1. Jalankan `python manage.py collect`. Catat singkat hasilnya (postingan baru per collector, galat bila ada).
2. Jalankan `python manage.py pending --limit N`. Keluarannya JSON berisi `hari_ini`, `ambang_skor`,
   `hari_mendesak`, `sisa_setelah_ini`, dan daftar `postingan` (id, caption, permalink, akun_ig,
   tanggal_posting, path_gambar). Jika `jumlah` 0, lompat ke langkah 4.
3. Untuk **setiap** postingan, satu per satu:
   1. Baca caption dan metadata.
   2. Jika `path_gambar` tidak null, **buka gambarnya dengan tool Read** (path absolut) dan baca seluruh
      teks posternya. Poster sering memuat tanggal, lokasi, jumlah peserta, dan kontak yang tidak ada di caption.
      Jika gambar tidak bisa dibuka, lanjutkan dengan caption saja dan sebut itu di `catatan`.
   3. Nilai sesuai kriteria.md: `relevan`, `skor` (1-10), `jenis_acara`, `alasan` (1-2 kalimat, sebut sinyal utamanya).
   4. Jika `skor >= ambang_skor`: ekstrak semua kolom detail dan tulis `draf_dm` dengan template di kriteria.md.
   5. Simpan segera (format di bawah). Jika keluar `GAGAL`, baca daftar kesalahannya, perbaiki JSON, lalu
      simpan ulang sampai `OK`. Jangan pindah ke postingan berikutnya sebelum tersimpan. Baca juga
      `PERINGATAN` bila ada, dan perbaiki dengan `--timpa` jika memang keliru.
4. Jalankan `python manage.py stats --json` untuk data ringkasan.
5. Tampilkan ringkasan akhir (format di bawah).

## Format penyimpanan

Kirim JSON lewat stdin memakai heredoc dengan penanda berkutip (`<<'JSON'`), supaya tanda kutip dan
apostrof di teks tidak rusak:

```bash
python manage.py save-result 12 --json - <<'JSON'
{
  "relevan": true,
  "skor": 8,
  "jenis_acara": "seminar",
  "alasan": "Seminar kampus 300 peserta di Bandung, HTM termasuk makan siang.",
  "nama_acara": "Seminar Nasional Digitalpreneur 2026",
  "penyelenggara": "HIMA Manajemen STIE Cendana",
  "tanggal_acara": "2026-10-10",
  "lokasi": "Aula Utama STIE Cendana, Jl. Cendana Raya No. 45, Bandung",
  "kota": "bandung",
  "perkiraan_peserta": 300,
  "kontak_ig": "hima.manajemen.stiecendana",
  "kontak_wa": "081200000101",
  "catatan": "CP Nadia. Acara 08.00-15.00, ada sesi makan siang.",
  "draf_dm": "Halo Kak panitia Seminar Nasional Digitalpreneur 2026! ..."
}
JSON
```

- **Selalu wajib:** `relevan` (true/false), `skor` (angka bulat 1-10), `jenis_acara`, `alasan`.
- **Jika skor >= ambang:** semua kolom di contoh wajib ada. Isi `null` (tanpa tanda kutip) jika tidak
  diketahui, bukan `""`, `"-"`, atau `"tidak diketahui"`. `nama_acara` dan `draf_dm` wajib berisi teks.
- **Jika skor < ambang:** cukup empat kolom wajib. Kolom lain boleh diisi jika jelas (mis. `kota`), tanpa `draf_dm`.
- Tipe data: `tanggal_acara` teks `"YYYY-MM-DD"`, `perkiraan_peserta` angka bulat, `kontak_wa` teks
  (mis. `"0812-3456-7890"`, akan dinormalkan), `kontak_ig` username tanpa `@`.
- Nilai `jenis_acara` dan `kota` yang diizinkan, beserta contoh lengkap: `python manage.py skema`.
- Iklan jualan, kompetitor, dan bukan acara harus `relevan: false` dan skor di bawah ambang (validator menolak selain itu).
- Untuk menimpa hasil yang sudah tersimpan, tambahkan `--timpa`.

## Ringkasan akhir

Tulis dalam bahasa Indonesia, ringkas:

1. **Diproses:** jumlah postingan yang dinilai pada putaran ini, berapa prospek bagus (skor >= ambang),
   dan berapa tidak relevan. Sebut juga hasil collect dan sisa antrean (`sisa_setelah_ini`); jika masih
   ada sisa, sarankan menjalankan `/radar` lagi.
2. **5 prospek teratas** (dari `teratas` di stats, urut tanggal acara terdekat), sebagai tabel:
   `#id | Nama acara | Tanggal (H-n) | Kota | Skor | Kontak`. Beri tanda ⚠️ jika sisa harinya kurang dari
   `hari_mendesak`.
3. Satu kalimat pengingat: buka dashboard (`python manage.py serve` → http://127.0.0.1:8000) untuk
   menyalin draf DM atau membuka WhatsApp. **DM dikirim manual.**

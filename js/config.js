const CONFIG = {
  APPS_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbwN3F16Hr_igxyAX-m2cAhlHbYAc7gznVAld92SabzaVLv-A6X6z7sj30LcGl6iZaM4/exec',
  APP_VERSION: '2.1',

  // Jenis kegiatan. `key` disimpan di kolom Kegiatan; colorVar merujuk ke token warna di css/style.css.
  // Isian: k1 = nama utama (judul kegiatan), k2 = isian kedua, lalu PIC & keterangan.
  ACTIVITY_TYPES: [
    {
      key: 'FLD', desc: 'Kunjungan TK', colorVar: '--fld', icon: 'kid',
      fields: [
        { slot: 'k1', label: 'Nama TK', max: 80, required: true },
        { slot: 'k2', label: 'Jumlah peserta', type: 'number', icon: 'people' },
        { slot: 'picName', label: 'Nama PIC', max: 60, icon: 'user' },
        { slot: 'picPhone', label: 'Nomor PIC', type: 'tel', max: 30, icon: 'phone' },
        { slot: 'note', label: 'Keterangan', type: 'textarea', max: 300, icon: 'note' }
      ]
    },
    {
      key: 'GCOM', desc: 'Komunitas', colorVar: '--gcom', icon: 'people',
      fields: [
        { slot: 'k1', label: 'Nama komunitas', max: 80, required: true },
        { slot: 'k2', label: 'Jumlah peserta', type: 'number', icon: 'people' },
        { slot: 'picName', label: 'Nama PIC', max: 60, icon: 'user' },
        { slot: 'picPhone', label: 'Nomor PIC', type: 'tel', max: 30, icon: 'phone' },
        { slot: 'note', label: 'Keterangan', type: 'textarea', max: 300, icon: 'note' }
      ]
    },
    {
      key: 'CX', desc: 'Pengalaman pelanggan', colorVar: '--cx', icon: 'star',
      fields: [
        { slot: 'k1', label: 'Tujuan kunjungan', max: 140, required: true },
        { slot: 'picName', label: 'Nama PIC', max: 60, icon: 'user' },
        { slot: 'picPhone', label: 'Nomor PIC', type: 'tel', max: 30, icon: 'phone' },
        { slot: 'note', label: 'Keterangan', type: 'textarea', max: 300, icon: 'note' }
      ]
    },
    {
      key: 'Support Event', desc: 'Dukungan acara', colorVar: '--se', icon: 'handshake',
      fields: [
        { slot: 'k1', label: 'Nama Event', max: 80, required: true },
        { slot: 'k2', label: 'Support', max: 140, required: true, icon: 'tag' },
        { slot: 'picName', label: 'Nama PIC', max: 60, icon: 'user' },
        { slot: 'picPhone', label: 'Nomor PIC', type: 'tel', max: 30, icon: 'phone' },
        { slot: 'note', label: 'Keterangan', type: 'textarea', max: 300, icon: 'note' }
      ]
    },
    {
      key: 'Lain-lain', desc: 'Kegiatan lainnya', colorVar: '--lain', icon: 'clipboard',
      fields: [
        { slot: 'k1', label: 'Keterangan', type: 'textarea', max: 140, required: true },
        { slot: 'picName', label: 'Nama PIC', max: 60, icon: 'user' },
        { slot: 'picPhone', label: 'Nomor PIC', type: 'tel', max: 30, icon: 'phone' }
      ]
    }
  ],

  // Isian untuk jenis kegiatan yang tidak dikenal (ditulis manual di sheet).
  GENERIC_FIELDS: [
    { slot: 'k1', label: 'Keterangan 1', max: 140 },
    { slot: 'k2', label: 'Keterangan 2', max: 140, icon: 'tag' },
    { slot: 'picName', label: 'Nama PIC', max: 60, icon: 'user' },
    { slot: 'picPhone', label: 'Nomor PIC', type: 'tel', max: 30, icon: 'phone' },
    { slot: 'note', label: 'Keterangan', type: 'textarea', max: 300, icon: 'note' }
  ],

  STATUSES: ['Terjadwal', 'Selesai', 'Batal'],

  // Warna palet ada di css/style.css ([data-palette]); themeColor untuk bilah status HP.
  PALETTES: {
    mint:     { label: 'Mint',     themeColor: { light: '#F2F6F5', dark: '#0F1514' } },
    lavender: { label: 'Lavender', themeColor: { light: '#F5F4FA', dark: '#121118' } },
    peach:    { label: 'Peach',    themeColor: { light: '#F8F4F2', dark: '#16110F' } }
  },

  LIMITS: { name: 60 },

  MONTHS: ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'],
  MONTHS_SHORT: ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'],
  DAYS: ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'],
  DAYS_SHORT: ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']
};

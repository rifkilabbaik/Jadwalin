const CONFIG = {
  APPS_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbwN3F16Hr_igxyAX-m2cAhlHbYAc7gznVAld92SabzaVLv-A6X6z7sj30LcGl6iZaM4/exec',
  APP_VERSION: '2.0',

  // colorVar merujuk ke token warna di css/style.css (bisa beda per palet).
  ACTIVITY_TYPES: [
    {
      key: 'FLD', name: 'Kunjungan TK', colorVar: '--fld', icon: 'school',
      fields: [
        { slot: 'k1', label: 'Nama TK', placeholder: 'contoh: TK Pelangi', max: 80, required: true },
        { slot: 'k2', label: 'Jumlah peserta', type: 'number' }
      ]
    },
    {
      key: 'GCOM', name: 'Komunitas', colorVar: '--gcom', icon: 'people',
      fields: [
        { slot: 'k1', label: 'Nama komunitas', placeholder: 'contoh: Komunitas Lari', max: 80, required: true },
        { slot: 'k2', label: 'Jumlah peserta', type: 'number' }
      ]
    },
    {
      key: 'CX', name: 'Pengalaman pelanggan', colorVar: '--cx', icon: 'heart',
      fields: [
        { slot: 'k1', label: 'Tujuan kunjungan', placeholder: 'contoh: Cek layanan kasir', max: 140, required: true }
      ]
    }
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

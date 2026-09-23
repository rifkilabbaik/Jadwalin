const CONFIG = {
  APPS_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbwN3F16Hr_igxyAX-m2cAhlHbYAc7gznVAld92SabzaVLv-A6X6z7sj30LcGl6iZaM4/exec',
  APP_VERSION: 'v1.0',

  ACTIVITY_TYPES: [
    {
      key: 'FLD', label: { id: 'FLD', en: 'FLD' }, color: '#3B82C4',
      fields: [
        { slot: 'k1', type: 'text',   max: 80, label: { id: 'Nama TK',         en: 'Kindergarten name' } },
        { slot: 'k2', type: 'number', max: 6,  label: { id: 'Jumlah Peserta',  en: 'Participants' } }
      ]
    },
    {
      key: 'GCOM', label: { id: 'GCOM', en: 'GCOM' }, color: '#C9853A',
      fields: [
        { slot: 'k1', type: 'text',   max: 80, label: { id: 'Nama Komunitas',  en: 'Community name' } },
        { slot: 'k2', type: 'number', max: 6,  label: { id: 'Jumlah Peserta',  en: 'Participants' } }
      ]
    },
    {
      key: 'CX', label: { id: 'CX', en: 'CX' }, color: '#4F9E76',
      fields: [
        { slot: 'k1', type: 'textarea', max: 140, label: { id: 'Tujuan Kunjungan', en: 'Visit purpose' } }
      ]
    }
  ],

  STATUSES: [
    { key: 'Terjadwal', label: { id: 'Terjadwal', en: 'Scheduled' } },
    { key: 'Selesai',   label: { id: 'Selesai',   en: 'Done' } },
    { key: 'Batal',     label: { id: 'Batal',     en: 'Cancelled' } }
  ],

  LIMITS: { name: 60 },

  LANGUAGES: {
    id: { id: 'Indonesia', en: 'Indonesian' },
    en: { id: 'Inggris',   en: 'English' }
  },

  // Palet sementara (sama dengan Rekapin) — ganti di sini saat palet Jadwalin sudah ada.
  PALETTES: {
    krem_biru: {
      label: { id: 'Krem Biru', en: 'Cream Blue' }, themeColor: '#F7F4EC',
      vars: {
        '--bone':'#F7F4EC','--bone-2':'#FFFDF7','--ink':'#1F2937','--ink-2':'#5B6472','--ink-3':'#8A93A0',
        '--line':'#E8E2D3','--line-2':'#D8D2C3',
        '--sea':'#4A90B8','--sea-hover':'#3A7A9E','--sea-2':'#E6F0F6','--sea-3':'#C7DDEA',
        '--danger':'#B85A4A','--danger-bg':'#FBEAE8','--danger-fg':'#8B3A2B',
        '--warn-bg':'#FFF4E6','--warn-fg':'#8B6A20',
        '--success':'#2A9D5A','--success-bg':'#E5F4EA'
      }
    },
    putih_hijau: {
      label: { id: 'Putih Hijau', en: 'White Green' }, themeColor: '#FAFAF7',
      vars: {
        '--bone':'#FAFAF7','--bone-2':'#FFFFFF','--ink':'#1F2937','--ink-2':'#5B6472','--ink-3':'#8A93A0',
        '--line':'#EBEBE5','--line-2':'#D8D8D2',
        '--sea':'#4A9B7F','--sea-hover':'#3A7E67','--sea-2':'#EAF3EF','--sea-3':'#C6DFD3',
        '--danger':'#B85A4A','--danger-bg':'#FBEAE8','--danger-fg':'#8B3A2B',
        '--warn-bg':'#FFF4E6','--warn-fg':'#8B6A20',
        '--success':'#2A9D5A','--success-bg':'#E5F4EA'
      }
    },
    gelap_biru: {
      label: { id: 'Gelap Biru', en: 'Dark Blue' }, themeColor: '#1A1D21',
      vars: {
        '--bone':'#1A1D21','--bone-2':'#22262B','--ink':'#E8E6E0','--ink-2':'#A0A5AD','--ink-3':'#6C7178',
        '--line':'#2E3238','--line-2':'#3A3F46',
        '--sea':'#6BB0D9','--sea-hover':'#7CBFE6','--sea-2':'#1E3A4A','--sea-3':'#2A5570',
        '--danger':'#D97565','--danger-bg':'#3A1E1A','--danger-fg':'#F0A090',
        '--warn-bg':'#3A2F1A','--warn-fg':'#E8C888',
        '--success':'#4CBF7C','--success-bg':'#1C3326'
      }
    },
    krem_biru_koral: {
      label: { id: 'Krem Biru Koral', en: 'Cream Blue Coral' }, themeColor: '#F7F4EC',
      vars: {
        '--bone':'#F7F4EC','--bone-2':'#FFFDF7','--ink':'#1F2937','--ink-2':'#5B6472','--ink-3':'#8A93A0',
        '--line':'#E8E2D3','--line-2':'#D8D2C3',
        '--sea':'#4A90B8','--sea-hover':'#3A7A9E','--sea-2':'#E6F0F6','--sea-3':'#C7DDEA',
        '--danger':'#B85A4A','--danger-bg':'#FBEAE8','--danger-fg':'#8B3A2B',
        '--warn-bg':'#FFF4E6','--warn-fg':'#8B6A20',
        '--success':'#2A9D5A','--success-bg':'#E5F4EA'
      }
    },
    putih_sage_emas: {
      label: { id: 'Putih Sage Emas', en: 'White Sage Gold' }, themeColor: '#FAFAF7',
      vars: {
        '--bone':'#FAFAF7','--bone-2':'#FFFFFF','--ink':'#1F2937','--ink-2':'#5B6472','--ink-3':'#8A93A0',
        '--line':'#EBEBE5','--line-2':'#D8D8D2',
        '--sea':'#7A9B8B','--sea-hover':'#5F8272','--sea-2':'#EAF1ED','--sea-3':'#CFDDD5',
        '--danger':'#B85A4A','--danger-bg':'#FBEAE8','--danger-fg':'#8B3A2B',
        '--warn-bg':'#FFF4E6','--warn-fg':'#8B6A20',
        '--success':'#2A9D5A','--success-bg':'#E5F4EA'
      }
    },
    gelap_teal_salmon: {
      label: { id: 'Gelap Teal Salmon', en: 'Dark Teal Salmon' }, themeColor: '#1E2226',
      vars: {
        '--bone':'#1E2226','--bone-2':'#262B30','--ink':'#E8E6E0','--ink-2':'#A0A5AD','--ink-3':'#6C7178',
        '--line':'#2E3238','--line-2':'#3A3F46',
        '--sea':'#5DB5B5','--sea-hover':'#6EC4C4','--sea-2':'#1E3A3A','--sea-3':'#2A5555',
        '--danger':'#D97565','--danger-bg':'#3A1E1A','--danger-fg':'#F0A090',
        '--warn-bg':'#3A2F1A','--warn-fg':'#E8C888',
        '--success':'#4CBF7C','--success-bg':'#1C3326'
      }
    }
  },

  FONT_OPTIONS: {
    default:   { label: { id: 'Default (sistem)', en: 'Default (system)' }, stack: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', system-ui, sans-serif" },
    rounded:   { label: { id: 'Bulat',            en: 'Rounded' },          stack: "'SF Pro Rounded', 'Nunito', 'Quicksand', ui-rounded, system-ui, sans-serif" },
    serif:     { label: { id: 'Klasik',           en: 'Serif' },            stack: "'Iowan Old Style', 'Georgia', 'Times New Roman', serif" },
    mono:      { label: { id: 'Monospace',        en: 'Monospace' },        stack: "'SF Mono', 'Menlo', 'Monaco', 'Consolas', monospace" },
    condensed: { label: { id: 'Rapat',            en: 'Condensed' },        stack: "'Roboto Condensed', 'PT Sans Narrow', 'Segoe UI', system-ui, sans-serif" }
  },

  I18N: {
    id: {
      nav_calendar: 'Kalender', nav_list: 'Daftar Kegiatan', nav_settings: 'Pengaturan', nav_install: 'Install aplikasi',
      close: 'Tutup', cancel: 'Batal', reset: 'Reset', ok: 'OK', save: 'Simpan', saving: 'Menyimpan...',
      search_placeholder: 'Cari...', no_result: 'Tidak ada hasil', all: 'Semua',
      chars_left: '{n} karakter lagi',
      loading: 'Memuat data',

      regional: 'Regional', area: 'Area',

      filter_title: 'Filter kegiatan', filter_month: 'Bulan', this_month: 'Bulan ini',

      act_add: 'Tambah kegiatan', act_calendar: 'Kalender kegiatan', act_list: 'Daftar kegiatan',
      act_form_add: 'Tambah kegiatan', act_form_edit: 'Ubah kegiatan',
      act_name: 'Nama', act_date: 'Tanggal', act_store: 'Toko', act_type: 'Kegiatan', act_status: 'Status',
      act_pick_store: 'Pilih toko', act_pick_type: 'Pilih kegiatan',
      act_saved: 'Kegiatan tersimpan', act_updated: 'Perubahan tersimpan',
      act_save_failed: 'Gagal menyimpan', act_offline: 'Tidak ada koneksi internet. Coba lagi saat online.',
      act_count: '{n} kegiatan',
      act_none: 'Belum ada kegiatan di bulan ini.',
      act_none_filter: 'Tidak ada kegiatan yang cocok dengan filter.',
      act_day_title: 'Kegiatan {date}', act_day_none: 'Belum ada kegiatan di tanggal ini.',
      act_add_on_day: 'Tambah di tanggal ini', act_tap_edit: 'Ketuk kegiatan untuk mengubah',
      act_reload: 'Muat ulang kegiatan', act_updated_at: 'Terakhir diubah {t}',
      act_err_name: 'Nama wajib diisi.', act_err_date: 'Tanggal wajib diisi.',
      act_err_store: 'Toko wajib dipilih.', act_err_type: 'Kegiatan wajib dipilih.',
      act_err_field: '{f} wajib diisi.',

      grp_upcoming: 'Akan dilaksanakan', grp_past: 'Sudah dilaksanakan',
      sum_all: 'Semua', sum_unconfirmed: '{n} belum dikonfirmasi', sum_done: '{n} selesai',
      sum_today: '{n} hari ini', sum_cancelled: '{n} batal',

      st_unconfirmed: 'Belum dikonfirmasi',
      today: 'Hari ini', tomorrow: 'Besok', yesterday: 'Kemarin',

      setting_theme: 'Tema', setting_language: 'Bahasa', setting_text: 'Format text',
      setting_regional_access: 'Regional yang bisa diakses', setting_regional_saved: 'Akses regional diperbarui',
      dd_all_regionals: 'Semua regional', dd_n_selected: '{n} dipilih',
      dd_select_all: 'Pilih semua', dd_clear: 'Kosongkan',
      setting_info: 'Info data', setting_status: 'Status', setting_connected: 'Terhubung', setting_not_connected: 'Belum terhubung',
      setting_total_act: 'Total kegiatan', setting_total_store: 'Toko terdaftar', setting_last_sync: 'Sinkron terakhir',
      setting_reload: 'Muat ulang data',
      setting_app: 'Aplikasi', setting_version: 'Versi', setting_cache_app: 'Cache app', setting_clear_cache: 'Bersihkan',
      setting_install: 'Install', install_btn: 'Install', install_done: 'Sudah terinstall',
      install_ios: 'Di iPhone/iPad: buka di Safari → tombol Bagikan → "Tambah ke Layar Utama".',
      install_manual: 'Buka menu browser → "Install aplikasi" / "Tambahkan ke layar utama".',
      stores_suffix: 'toko', acts_suffix: 'kegiatan',

      toast_cache_cleared: 'Cache dibersihkan. Refresh halaman.',
      toast_cache_loading: 'Data cache · memuat versi terbaru...',
      toast_load_failed: 'Gagal update: {msg}',
      toast_updated_app: 'Aplikasi diperbarui',
      splash_failed: 'Gagal: {msg}',

      months_short: ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'],
      months_full:  ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'],
      days_short:   ['Sen','Sel','Rab','Kam','Jum','Sab','Min']
    },
    en: {
      nav_calendar: 'Calendar', nav_list: 'Activity list', nav_settings: 'Settings', nav_install: 'Install app',
      close: 'Close', cancel: 'Cancel', reset: 'Reset', ok: 'OK', save: 'Save', saving: 'Saving...',
      search_placeholder: 'Search...', no_result: 'No result', all: 'All',
      chars_left: '{n} characters left',
      loading: 'Loading data',

      regional: 'Regional', area: 'Area',

      filter_title: 'Filter activities', filter_month: 'Month', this_month: 'This month',

      act_add: 'Add activity', act_calendar: 'Activity calendar', act_list: 'Activity list',
      act_form_add: 'Add activity', act_form_edit: 'Edit activity',
      act_name: 'Name', act_date: 'Date', act_store: 'Store', act_type: 'Activity', act_status: 'Status',
      act_pick_store: 'Pick a store', act_pick_type: 'Pick an activity',
      act_saved: 'Activity saved', act_updated: 'Changes saved',
      act_save_failed: 'Failed to save', act_offline: 'No internet connection. Try again when online.',
      act_count: '{n} activities',
      act_none: 'No activity this month yet.',
      act_none_filter: 'No activity matches the filter.',
      act_day_title: 'Activities on {date}', act_day_none: 'No activity on this date yet.',
      act_add_on_day: 'Add on this date', act_tap_edit: 'Tap an activity to edit',
      act_reload: 'Reload activities', act_updated_at: 'Last changed {t}',
      act_err_name: 'Name is required.', act_err_date: 'Date is required.',
      act_err_store: 'Store is required.', act_err_type: 'Activity is required.',
      act_err_field: '{f} is required.',

      grp_upcoming: 'Upcoming', grp_past: 'Past',
      sum_all: 'All', sum_unconfirmed: '{n} unconfirmed', sum_done: '{n} done',
      sum_today: '{n} today', sum_cancelled: '{n} cancelled',

      st_unconfirmed: 'Unconfirmed',
      today: 'Today', tomorrow: 'Tomorrow', yesterday: 'Yesterday',

      setting_theme: 'Theme', setting_language: 'Language', setting_text: 'Text style',
      setting_regional_access: 'Accessible regionals', setting_regional_saved: 'Regional access updated',
      dd_all_regionals: 'All regionals', dd_n_selected: '{n} selected',
      dd_select_all: 'Select all', dd_clear: 'Clear',
      setting_info: 'Data info', setting_status: 'Status', setting_connected: 'Connected', setting_not_connected: 'Not connected',
      setting_total_act: 'Total activities', setting_total_store: 'Registered stores', setting_last_sync: 'Last sync',
      setting_reload: 'Reload data',
      setting_app: 'Application', setting_version: 'Version', setting_cache_app: 'App cache', setting_clear_cache: 'Clear',
      setting_install: 'Install', install_btn: 'Install', install_done: 'Installed',
      install_ios: 'On iPhone/iPad: open in Safari → Share button → "Add to Home Screen".',
      install_manual: 'Open the browser menu → "Install app" / "Add to home screen".',
      stores_suffix: 'stores', acts_suffix: 'activities',

      toast_cache_cleared: 'Cache cleared. Refresh the page.',
      toast_cache_loading: 'Cached data · loading latest...',
      toast_load_failed: 'Update failed: {msg}',
      toast_updated_app: 'App updated',
      splash_failed: 'Failed: {msg}',

      months_short: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],
      months_full:  ['January','February','March','April','May','June','July','August','September','October','November','December'],
      days_short:   ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']
    }
  }
};

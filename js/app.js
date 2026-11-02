

const $ = (s) => document.querySelector(s);
const pad2 = (n) => String(n).padStart(2, '0');
const pd = (d) => { const [y, m, dd] = String(d).split('-').map(Number); return new Date(y, m - 1, dd); };
const fmt = (x) => x.getFullYear() + '-' + pad2(x.getMonth() + 1) + '-' + pad2(x.getDate());
const addDays = (d, n) => { const x = pd(d); x.setDate(x.getDate() + n); return fmt(x); };
const weekStart = (d) => { const x = pd(d); x.setDate(x.getDate() - (x.getDay() + 6) % 7); return fmt(x); };
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ic = (n, cls) => `<svg class="i${cls ? ' ' + cls : ''}" aria-hidden="true"><use href="#i-${n}"/></svg>`;

const App = {
  acts: [], stores: [], storeMeta: {}, storeIndex: {},
  access: [],
  filter: { regional: '', area: '', store: '', type: '', pic: '' },
  q: '',
  sel: '', y: 0, m: 0,
  calMode: 'bulan', agendaMode: 'tanggal', nuAll: false,
  theme: 'auto', palette: 'mint', userName: '', lastStore: '',
  lastSync: null, connected: false,
  overlay: null, drawerKind: null, detailId: null, confirmDel: false, busy: false,
  draft: null, formError: '', fdraft: null, editingName: false,
  installEvt: null, installed: false,

  async init() {
    this.loadSettings();
    this.applyTheme();
    const t = this.today();
    this.sel = t;
    this.y = pd(t).getFullYear();
    this.m = pd(t).getMonth();

    const params = new URLSearchParams(location.search);
    if (params.get('view') === 'bulan') this.agendaMode = 'bulan';

    this.bind();
    this.renderLegend();

    const ca = Sheets.loadList(Sheets.CACHE_KEY_ACTIVITY);
    const cs = Sheets.loadList(Sheets.CACHE_KEY_STORE);
    if (ca) {
      this.stores = cs ? cs.data : [];
      this.acts = ca.data;
      this.lastSync = ca.ts;
      this.buildStores();
      this.render();
      this.hideSplash();
      this.load(true);
    } else {
      this.render();
      await this.load(false);
    }
    if (params.get('add') === '1') this.openForm(null);
  },

  /* ---------- settings & theme ---------- */
  read(k) { try { return localStorage.getItem(k); } catch { return null; } },
  write(k, v) { try { if (v == null || v === '') localStorage.removeItem(k); else localStorage.setItem(k, v); } catch {} },
  loadSettings() {
    const th = this.read('jw_theme');
    this.theme = th === 'light' || th === 'dark' ? th : 'auto';
    const pa = this.read('jw_palette');
    this.palette = CONFIG.PALETTES[pa] ? pa : 'mint';
    this.userName = this.read('jw_name') || this.read('lastName') || '';
    this.lastStore = this.read('jw_store') || '';
    this.calMode = this.read('jw_calmode') === 'minggu' ? 'minggu' : 'bulan';
    this.agendaMode = this.read('jw_agenda') === 'bulan' ? 'bulan' : 'tanggal';
    try {
      const arr = JSON.parse(this.read('accessRegionals') || '[]');
      this.access = Array.isArray(arr) ? arr.filter(Boolean) : [];
    } catch { this.access = []; }
  },
  applyTheme() {
    const root = document.documentElement;
    if (this.theme === 'auto') delete root.dataset.theme; else root.dataset.theme = this.theme;
    if (this.palette === 'mint') delete root.dataset.palette; else root.dataset.palette = this.palette;
    const dark = this.theme === 'dark' || (this.theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = CONFIG.PALETTES[this.palette].themeColor[dark ? 'dark' : 'light'];
    document.querySelectorAll('[data-theme-set]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.themeSet === this.theme)));
    document.querySelectorAll('[data-pal]').forEach(b => b.setAttribute('aria-checked', String(b.dataset.pal === this.palette)));
  },
  setTheme(v) { this.theme = v; this.write('jw_theme', v === 'auto' ? '' : v); this.applyTheme(); },
  setPalette(v) { this.palette = v; this.write('jw_palette', v === 'mint' ? '' : v); this.applyTheme(); },

  /* ---------- data ---------- */
  async load(silent) {
    if (!silent) this.showSplash();
    try {
      const res = await Sheets.fetchAll();
      this.stores = Array.isArray(res.toko) ? res.toko : [];
      this.acts = Array.isArray(res.kegiatan) ? res.kegiatan : [];
      this.lastSync = Date.now();
      this.connected = true;
      this.buildStores();
      Sheets.saveList(Sheets.CACHE_KEY_ACTIVITY, this.acts);
      Sheets.saveList(Sheets.CACHE_KEY_STORE, this.stores);
      this.render();
      this.hideSplash();
      return true;
    } catch (e) {
      this.connected = false;
      if (!silent) this.splashError(e.message);
      else this.toast('Gagal memuat data terbaru: ' + e.message);
      if (this.drawerKind === 'settings') this.renderDrawer();
      return false;
    }
  },
  buildStores() {
    this.storeMeta = {};
    this.storeIndex = {};
    this.stores.forEach(s => {
      this.storeMeta[s.store] = { regional: s.regional || '', area: s.area || '' };
      const n = this.storeNorm(s.store);
      if (n && this.storeIndex[n] === undefined) this.storeIndex[n] = s.store;
    });
    const regs = this.allRegionals();
    if (this.stores.length) {
      const known = this.access.filter(r => regs.includes(r));
      if (known.length !== this.access.length || known.length === regs.length) this.setAccess(known.length === regs.length ? [] : known);
    }
    this.acts = this.acts.map(a => this.normRecord(a));
  },
  normRecord(a) {
    const s = String(a.status == null ? '' : a.status).trim();
    const status = CONFIG.STATUSES.find(x => x.toLowerCase() === s.toLowerCase()) || s || 'Terjadwal';
    return {
      id: String(a.id || ''),
      date: String(a.date || ''),
      name: String(a.name || '').trim(),
      store: this.canonStore(a.store),
      type: String(a.type || '').trim(),
      k1: String(a.k1 == null ? '' : a.k1).trim(),
      k2: String(a.k2 == null ? '' : a.k2).trim(),
      status,
      updatedAt: String(a.updatedAt || '')
    };
  },
  storeNorm(s) {
    return String(s == null ? '' : s).toLowerCase().replace(/^labbaik\s*chicken/, '').replace(/^lc\b/, '').replace(/[^a-z0-9]/g, '');
  },
  canonStore(name) {
    const raw = String(name == null ? '' : name).trim();
    return raw ? (this.storeIndex[this.storeNorm(raw)] || raw) : '';
  },
  short(s) { const m = String(s || '').match(/^[^-]+-\s*(.+)$/); return m ? m[1].trim() : String(s || ''); },
  allRegionals() { return Array.from(new Set(this.stores.map(s => s.regional).filter(Boolean))).sort(); },
  setAccess(list) { this.access = list; this.write('accessRegionals', list.length ? JSON.stringify(list) : ''); },
  storeAllowed(store) {
    if (!this.access.length) return true;
    const m = this.storeMeta[store];
    return !!m && this.access.includes(m.regional);
  },
  inScope(store, regional, area) {
    if (!regional && !area) return true;
    const m = this.storeMeta[store];
    return !!m && (!regional || m.regional === regional) && (!area || m.area === area);
  },
  storeList() {
    let list = this.stores.map(s => s.store).filter(s => this.storeAllowed(s));
    if (!list.length) list = Array.from(new Set(this.acts.map(a => a.store).filter(Boolean))).filter(s => this.storeAllowed(s));
    return list.sort((a, b) => this.short(a).localeCompare(this.short(b)));
  },
  matches(a) {
    const f = this.filter;
    if (!a.date || !this.storeAllowed(a.store)) return false;
    if (f.store && a.store !== f.store) return false;
    if ((f.regional || f.area) && !this.inScope(a.store, f.regional, f.area)) return false;
    if (f.type && a.type !== f.type) return false;
    if (f.pic && a.name !== f.pic) return false;
    return true;
  },
  visible() { return this.acts.filter(a => this.matches(a)); },
  filterCount() { return ['regional', 'area', 'store', 'type', 'pic'].filter(k => this.filter[k]).length; },

  today() { return fmt(new Date()); },
  type(key) { return CONFIG.ACTIVITY_TYPES.find(t => t.key === key) || null; },
  hue(key) { const t = this.type(key); return `--hue:var(${t ? t.colorVar : '--ink-3'})`; },
  typeOrder(key) { const i = CONFIG.ACTIVITY_TYPES.findIndex(t => t.key === key); return i < 0 ? 99 : i; },
  titleOf(a) { const t = this.type(a.type); return a.k1 || (t ? t.name : a.type) || 'Kegiatan'; },
  numberField(type) { return type ? type.fields.find(f => f.type === 'number') : null; },
  byDate(a, b) { return a.date.localeCompare(b.date) || App.typeOrder(a.type) - App.typeOrder(b.type) || App.titleOf(a).localeCompare(App.titleOf(b)); },
  dShort(d) { const x = pd(d); return CONFIG.DAYS_SHORT[x.getDay()] + ', ' + x.getDate() + ' ' + CONFIG.MONTHS_SHORT[x.getMonth()]; },
  dFull(d) { const x = pd(d); return CONFIG.DAYS[x.getDay()] + ', ' + x.getDate() + ' ' + CONFIG.MONTHS[x.getMonth()] + ' ' + x.getFullYear(); },
  stamp(s) {
    const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
    if (!m) return s || '—';
    return Number(m[3]) + ' ' + CONFIG.MONTHS_SHORT[Number(m[2]) - 1] + ' ' + m[1] + ', ' + m[4] + '.' + m[5];
  },
  needList() {
    const t = this.today();
    return this.visible().filter(a => a.date < t && a.status === 'Terjadwal').sort((a, b) => this.byDate(a, b));
  },
  counts() {
    const t = this.today(), ws = weekStart(t), we = addDays(ws, 6);
    const vis = this.visible();
    const live = vis.filter(a => a.status !== 'Batal');
    return {
      today: live.filter(a => a.date === t).length,
      week: live.filter(a => a.date >= ws && a.date <= we).length,
      need: vis.filter(a => a.date < t && a.status === 'Terjadwal').length,
      done: vis.filter(a => a.status === 'Selesai' && a.date.slice(0, 7) === t.slice(0, 7)).length
    };
  },

  /* ---------- render ---------- */
  render() {
    this.renderTop();
    this.renderStats();
    this.renderCal();
    this.renderSide();
    if (this.overlay === 'drawer' && this.drawerKind !== 'filter') this.renderDrawer();
  },
  renderTop() {
    const t = pd(this.today());
    $('#todayLabel').textContent = CONFIG.DAYS[t.getDay()] + ', ' + t.getDate() + ' ' + CONFIG.MONTHS[t.getMonth()];
    const first = this.userName.split(/\s+/)[0];
    $('#helloLabel').textContent = first ? 'Halo, ' + first : 'Halo!';
    $('#filterDot').hidden = this.filterCount() === 0;
    $('#btnFilter').setAttribute('aria-label', this.filterCount() ? 'Filter (' + this.filterCount() + ' aktif)' : 'Filter');
  },
  renderStats() {
    const c = this.counts();
    $('#stats').innerHTML = [
      ['cal', 'h-primary', c.today, 'hari ini', ''],
      ['clock', 'h-primary', c.week, 'minggu ini', ''],
      ['refresh', 'h-warn', c.need, 'perlu update', c.need ? ' warn' : ''],
      ['check', 'h-ok', c.done, 'selesai bulan ini', '']
    ].map(([i, h, n, label, w]) => `<div class="stat${w}"><span class="ib hue ${h}">${ic(i)}</span><div><b>${n}</b><span class="l">${label}</span></div></div>`).join('');
  },
  renderLegend() {
    $('#legend').innerHTML = CONFIG.ACTIVITY_TYPES.map(t => `<span style="${this.hue(t.key)}"><i></i>${esc(t.key)}</span>`).join('');
  },
  calCells() {
    const cells = [];
    let title;
    if (this.calMode === 'minggu') {
      const ws = weekStart(this.sel);
      for (let i = 0; i < 7; i++) cells.push(addDays(ws, i));
      const a = pd(cells[0]), b = pd(cells[6]);
      title = a.getMonth() === b.getMonth()
        ? a.getDate() + '–' + b.getDate() + ' ' + CONFIG.MONTHS_SHORT[a.getMonth()] + ' ' + a.getFullYear()
        : a.getDate() + ' ' + CONFIG.MONTHS_SHORT[a.getMonth()] + ' – ' + b.getDate() + ' ' + CONFIG.MONTHS_SHORT[b.getMonth()] + ' ' + b.getFullYear();
    } else {
      const off = (new Date(this.y, this.m, 1).getDay() + 6) % 7;
      const dim = new Date(this.y, this.m + 1, 0).getDate();
      for (let i = 0; i < off; i++) cells.push(null);
      for (let d = 1; d <= dim; d++) cells.push(fmt(new Date(this.y, this.m, d)));
      title = CONFIG.MONTHS[this.m] + ' ' + this.y;
    }
    return { cells, title };
  },
  renderCal() {
    const t = this.today();
    const { cells, title } = this.calCells();
    $('#calTitle').textContent = title;
    const week = this.calMode === 'minggu';
    $('#calDays').classList.toggle('week', week);
    const byDay = {};
    this.visible().forEach(a => { (byDay[a.date] = byDay[a.date] || []).push(a); });
    const max = week ? 9 : 2;
    $('#calDays').innerHTML = cells.map(ds => {
      if (!ds) return '<span class="day blank"></span>';
      const items = (byDay[ds] || []).sort((a, b) => this.byDate(a, b));
      const cls = ['day'];
      if (ds === t) cls.push('today'); else if (ds < t) cls.push('past');
      if (ds === this.sel) cls.push('sel');
      const dots = items.slice(0, 3).map(a => `<i class="${a.status === 'Batal' ? 'off' : ''}" style="${this.hue(a.type)}"></i>`).join('');
      const evs = items.slice(0, max).map(a =>
        `<span class="ev hue${a.status === 'Batal' ? ' off' : ''}" style="${this.hue(a.type)}">${a.status === 'Selesai' ? '✓ ' : ''}${esc(this.titleOf(a))}</span>`).join('');
      const more = items.length > max ? `<span class="more">+${items.length - max}</span>` : '';
      const label = this.dFull(ds) + (items.length ? ', ' + items.length + ' kegiatan' : '');
      return `<button class="${cls.join(' ')}" data-d="${ds}" aria-label="${label}" aria-pressed="${ds === this.sel}">
        <span class="day-top"><span class="n">${pd(ds).getDate()}</span>${more}</span>
        <span class="dots">${dots}</span><span class="evs">${evs}</span></button>`;
    }).join('');
    document.querySelectorAll('#calMode [data-mode]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mode === this.calMode)));
    const tp = pd(t);
    const viewingToday = week ? weekStart(this.sel) === weekStart(t) : (this.y === tp.getFullYear() && this.m === tp.getMonth());
    $('#calToday').hidden = viewingToday && this.sel === t;
  },
  card(a) {
    const t = this.today();
    const x = pd(a.date);
    let pill = '';
    if (a.status === 'Selesai') pill = `<span class="pill hue h-ok">Selesai</span>`;
    else if (a.status === 'Batal') pill = `<span class="pill hue h-bad">Batal</span>`;
    else if (a.date < t && a.status === 'Terjadwal') pill = `<span class="pill hue h-warn">Perlu update</span>`;
    else if (a.status !== 'Terjadwal') pill = `<span class="pill hue h-primary">${esc(a.status)}</span>`;
    const n = a.k2 && this.numberField(this.type(a.type)) ? a.k2 + ' peserta' : '';
    const meta = [this.short(a.store), a.name, n].filter(Boolean).join(' · ');
    return `<button class="act${a.status === 'Batal' ? ' is-batal' : ''}" style="${this.hue(a.type)}" data-open="${esc(a.id)}">
      <span class="date-b hue"><b>${x.getDate()}</b><small>${CONFIG.DAYS_SHORT[x.getDay()]}</small></span>
      <span class="act-body">
        <span class="act-top"><span class="chip hue">${esc(a.type || '—')}</span>${pill}</span>
        <span class="act-title">${esc(this.titleOf(a))}</span>
        <span class="act-meta">${esc(meta)}</span>
      </span>${ic('chev-r')}</button>`;
  },
  needsCard() {
    const list = this.needList();
    const shown = this.nuAll ? list : list.slice(0, 5);
    const rows = shown.map(a => `
      <div class="nu-row" style="${this.hue(a.type)}" data-id="${esc(a.id)}">
        <span class="nu-dot"></span>
        <button class="nu-body" data-open="${esc(a.id)}"><span class="nu-title">${esc(this.titleOf(a))}</span><span class="nu-meta">${this.dShort(a.date)} · ${esc(this.short(a.store))}</span></button>
        <button class="qa hue h-ok" data-qa="Selesai" aria-label="Tandai ${esc(this.titleOf(a))} selesai">${ic('check')}</button>
        <button class="qa hue h-bad" data-qa="Batal" aria-label="Tandai ${esc(this.titleOf(a))} batal">${ic('x')}</button>
      </div>`).join('');
    const more = list.length > shown.length
      ? `<div class="nu-more">dan ${list.length - shown.length} lainnya · <button class="link" data-act="nu-all">Tampilkan semua</button></div>` : '';
    return `<section class="card nu${list.length ? '' : ' calm'}" aria-label="Perlu update">
      <div class="sec-head"><span class="sec-title">Perlu update</span>${list.length ? `<span class="count">${list.length}</span>` : ''}</div>
      ${list.length ? '<p class="sec-sub">Sudah lewat tapi masih terjadwal. Sudah terlaksana?</p>' : ''}
      <div class="nu-list">${list.length ? rows + more : `<div class="nu-done">${ic('check')}Semua kegiatan sudah ter-update.</div>`}</div>
    </section>`;
  },
  renderSide() {
    const side = $('#side');
    const q = this.q.trim().toLowerCase();
    if (q) {
      const hits = this.visible().filter(a => [this.titleOf(a), a.store, a.name, a.type, a.k1].join(' ').toLowerCase().includes(q))
        .sort((a, b) => this.byDate(b, a));
      side.innerHTML = `<section class="agenda full" aria-label="Hasil pencarian">
        <div class="sec-head"><span class="sec-title">Hasil pencarian</span><span class="sec-date">${hits.length} kegiatan</span></div>
        ${hits.length ? hits.slice(0, 60).map(a => this.card(a)).join('') : `<div class="empty"><span class="blob">${ic('search')}</span><p>Tidak ada kegiatan yang cocok dengan “${esc(this.q.trim())}”.</p></div>`}
      </section>`;
      return;
    }
    const t = this.today();
    const seg = `<div class="seg small" role="group" aria-label="Isi daftar">
      <button data-amode="tanggal" aria-pressed="${this.agendaMode === 'tanggal'}">Tanggal</button>
      <button data-amode="bulan" aria-pressed="${this.agendaMode === 'bulan'}">Sebulan</button></div>`;
    let body;
    if (this.agendaMode === 'bulan') {
      const key = this.y + '-' + pad2(this.m + 1);
      const rows = this.visible().filter(a => a.date.slice(0, 7) === key);
      const up = rows.filter(a => a.date >= t).sort((a, b) => this.byDate(a, b));
      const past = rows.filter(a => a.date < t).sort((a, b) => this.byDate(b, a));
      body = `<div class="sec-head"><span class="sec-title">${CONFIG.MONTHS[this.m]} ${this.y}</span><span class="sec-note">${rows.length} kegiatan</span>${seg}</div>`;
      if (!rows.length) body += `<div class="empty"><span class="blob">${ic('cal')}</span><p>Belum ada kegiatan di bulan ini.</p><button class="link" data-act="add-day">Tambah kegiatan</button></div>`;
      if (up.length) body += `<div class="list-group"><span>Akan dilaksanakan</span><span>${up.length}</span></div>` + up.map(a => this.card(a)).join('');
      if (past.length) body += `<div class="list-group"><span>Sudah dilaksanakan</span><span>${past.length}</span></div>` + past.map(a => this.card(a)).join('');
    } else {
      const day = this.visible().filter(a => a.date === this.sel).sort((a, b) => this.byDate(a, b));
      const tmr = addDays(t, 1);
      const head = this.sel === t ? 'Hari ini' : this.sel === tmr ? 'Besok' : this.sel === addDays(t, -1) ? 'Kemarin' : this.dShort(this.sel);
      const note = [t, tmr, addDays(t, -1)].includes(this.sel) ? this.dShort(this.sel) : '';
      body = `<div class="sec-head"><span class="sec-title">${head}</span>${note ? `<span class="sec-note">${note}</span>` : ''}${seg}</div>`;
      body += day.length ? day.map(a => this.card(a)).join('') : `
        <div class="empty"><span class="blob">${ic('cal')}</span><p>Belum ada kegiatan di tanggal ini.</p>
        <button class="link" data-act="add-day">Tambah di tanggal ini</button></div>`;
      const next = this.visible().filter(a => a.date > this.sel && a.status !== 'Batal').sort((a, b) => this.byDate(a, b)).slice(0, 4);
      if (next.length) body += `<div class="sec-head" style="margin-top:6px"><span class="sec-title">Akan datang</span></div>` + next.map(a => this.card(a)).join('');
    }
    side.innerHTML = this.needsCard() + `<section class="agenda" id="agenda" aria-label="Daftar kegiatan">${body}</section>`;
  },

  /* ---------- overlays ---------- */
  showOverlay(which) {
    const wasOpen = !!this.overlay;
    if (!wasOpen) this.lastFocus = document.activeElement;
    $('#drawer').hidden = which !== 'drawer';
    $('#dialog').hidden = which !== 'dialog';
    $('#scrim').hidden = false;
    document.body.classList.add('locked');
    if (this.overlay !== which) {
      const el = which === 'drawer' ? $('#drawer') : $('#dialog');
      el.classList.remove('anim');
      void el.offsetWidth;
      el.classList.add('anim');
      el.scrollTop = 0;
      if (which === 'drawer') $('#drawerBody').scrollTop = 0;
    }
    if (!wasOpen) {
      try { history.pushState({ jwOverlay: true }, ''); this.pushed = true; } catch { this.pushed = false; }
    }
    this.overlay = which;
  },
  closeOverlay(fromPop) {
    if (!this.overlay) return;
    $('#drawer').hidden = true;
    $('#dialog').hidden = true;
    $('#scrim').hidden = true;
    document.body.classList.remove('locked');
    this.overlay = null;
    this.drawerKind = null;
    this.draft = null;
    this.confirmDel = false;
    this.editingName = false;
    if (this.pushed && !fromPop) { this.pushed = false; this.skipPop = true; history.back(); }
    else this.pushed = false;
    if (this.lastFocus && document.contains(this.lastFocus)) { try { this.lastFocus.focus({ preventScroll: true }); } catch {} }
  },
  openDrawer(kind) {
    this.drawerKind = kind;
    this.confirmDel = false;
    this.editingName = false;
    this.showOverlay('drawer');
    this.renderDrawer();
  },
  renderDrawer() {
    const k = this.drawerKind;
    if (k === 'detail') {
      const a = this.acts.find(x => x.id === this.detailId);
      if (!a) { this.closeOverlay(); return; }
      $('#drawerTitle').textContent = 'Detail kegiatan';
      $('#drawerBody').innerHTML = this.detailHTML(a);
    } else if (k === 'settings') {
      $('#drawerTitle').textContent = 'Pengaturan';
      $('#drawerBody').innerHTML = this.settingsHTML();
      this.applyTheme();
    } else if (k === 'filter') {
      $('#drawerTitle').textContent = 'Filter';
      $('#drawerBody').innerHTML = this.filterHTML();
    }
  },

  /* ---------- detail ---------- */
  openDetail(id) { this.detailId = id; this.openDrawer('detail'); },
  detailHTML(a) {
    const t = this.type(a.type);
    const nf = this.numberField(t);
    const rows = [
      ['pin', 'Toko', a.store || '—'],
      ['user', 'Dicatat oleh', a.name || '—'],
      nf ? ['people', nf.label, a.k2 ? a.k2 + ' orang' : 'Belum diisi'] : null,
      !t && a.k2 ? ['tag', 'Keterangan 2', a.k2] : null,
      ['clock', 'Terakhir diubah', a.updatedAt ? this.stamp(a.updatedAt) : '—']
    ].filter(Boolean);
    const dis = this.busy ? ' disabled' : '';
    return `
      <section class="hero" style="${this.hue(a.type)}">
        <span class="ib">${ic(t ? t.icon : 'cal')}</span>
        <span class="chip">${esc(a.type || 'Kegiatan')}${t ? ' · ' + esc(t.name) : ''}</span>
        <h3>${esc(this.titleOf(a))}</h3>
        <div class="when">${this.dFull(a.date)}</div>
      </section>
      <section class="card info">${rows.map(([i, k, v]) => `
        <div class="info-row"><span class="ii">${ic(i)}</span><div><div class="k">${esc(k)}</div><div class="v">${esc(v)}</div></div></div>`).join('')}
      </section>
      <div class="field">
        <span class="label" style="padding-left:6px">Status</span>
        <div class="status3" role="group" aria-label="Status kegiatan">
          ${[['Terjadwal', 'clock', 'h-primary'], ['Selesai', 'check', 'h-ok'], ['Batal', 'x', 'h-bad']].map(([s, i, h]) => `
            <button class="sbtn ${h}" data-status="${s}" aria-pressed="${a.status === s}"${dis}><span class="ib">${ic(i)}</span>${s}</button>`).join('')}
        </div>
      </div>
      <div class="row2">
        <a class="btn-soft wa" href="${esc(this.waLink(a))}" target="_blank" rel="noopener">${ic('chat')}Bagikan</a>
        <button class="btn-soft" data-act="edit"${dis}>${ic('pencil')}Ubah</button>
      </div>
      ${this.confirmDel ? `
        <div class="confirm" role="alertdialog" aria-label="Konfirmasi hapus">
          <p>Hapus “${esc(this.titleOf(a))}”?<small>Kegiatan ini juga dihapus dari spreadsheet dan tidak bisa dikembalikan.</small></p>
          <div class="row2"><button class="btn-plain" data-act="cancel-del"${dis}>Batal</button><button class="btn-bad" data-act="do-del"${dis}>${this.busy ? 'Menghapus...' : 'Hapus'}</button></div>
        </div>` : `<button class="btn-text" data-act="del"${dis}>${ic('trash')}Hapus kegiatan</button>`}`;
  },
  waLink(a) {
    const t = this.type(a.type);
    const nf = this.numberField(t);
    const lines = [
      '*Agenda Jadwalin*',
      (a.type ? a.type + ' · ' : '') + this.titleOf(a),
      this.dFull(a.date),
      a.store,
      a.name ? 'PIC: ' + a.name : '',
      nf && a.k2 ? 'Peserta: ' + a.k2 : '',
      'Status: ' + a.status
    ].filter(Boolean);
    return 'https://wa.me/?text=' + encodeURIComponent(lines.join('\n'));
  },
  rowOf(a) {
    const row = { date: a.date, name: a.name, store: a.store, type: a.type, k1: a.k1, k2: a.k2, status: a.status };
    if (a.id) row.id = a.id;
    return row;
  },
  replaceAct(saved, fallback) {
    const rec = this.normRecord(saved && saved.id ? saved : fallback);
    const i = this.acts.findIndex(x => x.id === rec.id);
    if (i >= 0) this.acts[i] = rec; else this.acts.push(rec);
    Sheets.saveList(Sheets.CACHE_KEY_ACTIVITY, this.acts);
    return rec;
  },
  offline() { return navigator.onLine === false; },
  async saveStatus(a, status) {
    if (this.offline()) { this.toast('Tidak ada koneksi internet. Coba lagi saat online.'); return false; }
    const next = { ...a, status };
    try {
      const saved = await Sheets.updateActivity(this.rowOf(next));
      this.replaceAct(saved, next);
      return true;
    } catch (e) {
      this.toast('Gagal menyimpan: ' + e.message);
      return false;
    }
  },
  async detailStatus(status) {
    const a = this.acts.find(x => x.id === this.detailId);
    if (!a || a.status === status || this.busy) return;
    this.busy = true;
    this.renderDrawer();
    const ok = await this.saveStatus(a, status);
    this.busy = false;
    this.render();
    if (this.overlay === 'drawer') this.renderDrawer();
    if (ok) this.toast('Status diubah: ' + status);
  },
  async deleteDetail() {
    const a = this.acts.find(x => x.id === this.detailId);
    if (!a || this.busy) return;
    if (this.offline()) { this.toast('Tidak ada koneksi internet. Coba lagi saat online.'); return; }
    this.busy = true;
    this.renderDrawer();
    try {
      await Sheets.deleteActivity(a.id);
      this.acts = this.acts.filter(x => x.id !== a.id);
      Sheets.saveList(Sheets.CACHE_KEY_ACTIVITY, this.acts);
      this.busy = false;
      this.closeOverlay();
      this.render();
      this.toast('Kegiatan dihapus');
    } catch (e) {
      this.busy = false;
      this.renderDrawer();
      const old = /unknown action/i.test(e.message);
      this.toast(old ? 'Fitur hapus butuh Apps Script terbaru. Salin ulang Code.gs lalu deploy versi baru.' : 'Gagal menghapus: ' + e.message);
    }
  },
  async quickAction(btn) {
    const row = btn.closest('.nu-row');
    const a = this.acts.find(x => x.id === row.dataset.id);
    if (!a) return;
    row.classList.add('busy');
    const ok = await this.saveStatus(a, btn.dataset.qa);
    if (!ok) { row.classList.remove('busy'); return; }
    row.classList.remove('busy');
    row.classList.add('gone');
    setTimeout(() => { this.render(); this.toast(btn.dataset.qa === 'Selesai' ? 'Ditandai selesai' : 'Ditandai batal'); }, 360);
  },

  /* ---------- form ---------- */
  openForm(a, date) {
    const t = this.today();
    if (a) {
      this.draft = { editId: a.id, type: a.type, date: a.date, store: a.store, k1: a.k1, k2: a.k2, name: a.name, status: a.status, askName: false };
    } else {
      const d = date || (this.sel >= t ? this.sel : t);
      const store = this.filter.store || (this.storeList().includes(this.lastStore) ? this.lastStore : '');
      this.draft = { editId: null, type: this.filter.type || CONFIG.ACTIVITY_TYPES[0].key, date: d, store, k1: '', k2: '', name: this.userName, status: 'Terjadwal', askName: !this.userName };
    }
    this.formError = '';
    this.showOverlay('dialog');
    this.renderForm(false);
    if (window.matchMedia('(pointer: fine)').matches) {
      setTimeout(() => { const el = $('#dialog').querySelector(this.draft && this.draft.askName ? '#fName' : '#fK1'); if (el) el.focus({ preventScroll: true }); }, 80);
    }
  },
  keepDraft() {
    const d = this.draft;
    if (!d) return;
    const g = (id) => { const el = document.getElementById(id); return el ? el.value : null; };
    const name = g('fName'); if (name != null) d.name = name;
    const k1 = g('fK1'); if (k1 != null) d.k1 = k1;
    const k2 = g('fK2'); if (k2 != null) d.k2 = k2;
    const st = g('fStoreText'); if (st != null) d.store = st;
  },
  renderForm(popType) {
    const d = this.draft;
    const edit = !!d.editId;
    const t = this.today(), tmr = addDays(t, 1);
    const type = this.type(d.type);
    const fields = type ? type.fields : [
      { slot: 'k1', label: 'Keterangan 1', max: 140 },
      { slot: 'k2', label: 'Keterangan 2', max: 140 }
    ];
    const other = d.date !== t && d.date !== tmr;
    const types = CONFIG.ACTIVITY_TYPES.slice();
    if (d.type && !type) types.push({ key: d.type, name: 'Lainnya', icon: 'tag' });
    const tiles = types.map(x => `
      <button type="button" class="tile${popType && x.key === d.type ? ' pop' : ''}" style="${this.hue(x.key)}" data-type="${esc(x.key)}" aria-pressed="${x.key === d.type}">
        <span class="ib hue">${ic(x.icon)}</span><span class="tile-text"><b>${esc(x.key)}</b><small>${esc(x.name)}</small></span>
      </button>`).join('');
    const stores = this.storeList();
    if (d.store && !stores.includes(d.store)) stores.unshift(d.store);
    const storeField = stores.length
      ? this.ddHTML('fStore', stores.map(s => ({ v: s, l: this.short(s) })), d.store, 'Pilih toko', 'pin')
      : `<input class="input" id="fStoreText" maxlength="120" placeholder="Nama toko" value="${esc(d.store)}" autocomplete="off">`;
    const fieldHTML = fields.map(f => {
      const id = f.slot === 'k1' ? 'fK1' : 'fK2';
      if (f.type === 'number') {
        return `<div class="field"><label class="label" for="${id}">${esc(f.label)} <span class="opt">· boleh diisi nanti</span></label>
          <div class="stepper">
            <button type="button" data-step="-1" aria-label="Kurangi">${ic('minus')}</button>
            <input id="${id}" type="number" inputmode="numeric" min="0" max="99999" placeholder="0" value="${esc(d[f.slot])}">
            <button type="button" data-step="1" aria-label="Tambah">${ic('plus')}</button>
          </div></div>`;
      }
      return `<div class="field"><label class="label" for="${id}">${esc(f.label)}${f.required ? '' : ' <span class="opt">· opsional</span>'}</label>
        <input class="input" id="${id}" maxlength="${f.max || 140}" autocomplete="off" placeholder="${esc(f.placeholder || '')}" value="${esc(d[f.slot])}"></div>`;
    }).join('');
    const nameField = d.askName ? `
      <div class="field wide-field"><label class="label" for="fName">Nama kamu</label>
        <input class="input" id="fName" maxlength="${CONFIG.LIMITS.name}" autocomplete="name" placeholder="contoh: Rina" value="${esc(d.name)}">
        <span class="opt" style="font-size:12px">Disimpan untuk kegiatan berikutnya.</span></div>` : '';
    let by = '';
    if (edit) by = `${ic('user')}Dicatat oleh <b>${esc(d.name || '—')}</b>`;
    else if (!d.askName) by = `${ic('user')}Dicatat sebagai <b>${esc(d.name)}</b> · <button type="button" class="link" data-act="ask-name">ganti</button>`;

    $('#dialogTitle').textContent = edit ? 'Ubah kegiatan' : 'Kegiatan baru';
    $('#dialogBody').innerHTML = `
      <div class="field"><span class="label">Jenis kegiatan</span><div class="tiles">${tiles}</div></div>
      <div class="form-grid">
        ${nameField}
        <div class="field"><span class="label">Tanggal</span>
          <div class="chips">${[['today', 'Hari ini', d.date === t], ['tomorrow', 'Besok', d.date === tmr], ['other', other ? this.dShort(d.date) : 'Tanggal lain', other]]
            .map(([k, l, on]) => `<button type="button" class="chipbtn" data-date="${k}" aria-pressed="${on}">${l}</button>`).join('')}</div>
          ${other ? `<input class="input" type="date" id="fDate" value="${esc(d.date)}" aria-label="Tanggal kegiatan">` : ''}
        </div>
        <div class="field"><span class="label" id="fStoreLabel">Toko</span>${storeField}</div>
        ${fieldHTML}
      </div>
      ${this.formError ? `<div class="form-error" role="alert">${esc(this.formError)}</div>` : ''}
      <div class="form-foot"><div class="by">${by}</div>
        <button type="submit" class="btn-big" id="fSave">${edit ? 'Simpan perubahan' : 'Simpan kegiatan'}</button></div>`;
  },
  async saveForm() {
    this.keepDraft();
    const d = this.draft;
    if (!d) return;
    const type = this.type(d.type);
    const err = (msg, focus) => {
      this.formError = msg;
      this.renderForm(false);
      const el = focus && document.getElementById(focus);
      if (el) el.focus();
    };
    d.name = String(d.name || '').trim();
    d.k1 = String(d.k1 || '').trim();
    d.k2 = String(d.k2 || '').trim();
    d.store = String(d.store || '').trim();
    if (!d.name) { d.askName = true; return err('Isi nama kamu dulu.', 'fName'); }
    if (!d.type) return err('Pilih jenis kegiatan.');
    if (!d.date) return err('Pilih tanggal kegiatan.');
    if (!d.store) return err('Pilih toko.', 'fStore');
    if (type) {
      for (const f of type.fields) {
        if (f.required && !d[f.slot]) return err(f.label + ' wajib diisi.', f.slot === 'k1' ? 'fK1' : 'fK2');
      }
    }
    if (this.offline()) return err('Tidak ada koneksi internet. Coba lagi saat online.');
    const edit = !!d.editId;
    const row = { date: d.date, name: d.name, store: d.store, type: d.type, k1: d.k1, k2: d.k2, status: d.status || 'Terjadwal' };
    if (edit) row.id = d.editId;
    const btn = $('#fSave');
    btn.disabled = true;
    btn.textContent = 'Menyimpan...';
    try {
      const saved = edit ? await Sheets.updateActivity(row) : await Sheets.addActivity(row);
      const rec = this.replaceAct(saved, { ...row, id: row.id || ('tmp-' + Date.now()) });
      if (!edit) {
        if (d.askName || !this.userName) { this.userName = d.name; this.write('jw_name', d.name); }
        this.lastStore = d.store;
        this.write('jw_store', d.store);
      }
      this.sel = rec.date;
      this.y = pd(rec.date).getFullYear();
      this.m = pd(rec.date).getMonth();
      this.agendaMode = 'tanggal';
      this.write('jw_agenda', '');
      this.closeOverlay();
      this.render();
      this.toast(edit ? 'Perubahan tersimpan' : 'Kegiatan tersimpan');
    } catch (e) {
      this.formError = 'Gagal menyimpan: ' + e.message;
      this.renderForm(false);
    }
  },

  /* ---------- searchable dropdown ---------- */
  ddHTML(id, opts, value, placeholder, lead) {
    const cur = opts.find(o => o.v === value);
    this.ddOpts = this.ddOpts || {};
    this.ddOpts[id] = opts;
    return `<div class="dropdown" data-dd="${id}" data-value="${esc(cur ? cur.v : '')}">
      <button type="button" class="dd-btn${cur ? '' : ' is-empty'}" id="${id}" aria-haspopup="listbox" aria-expanded="false">
        ${lead ? ic(lead, 'lead') : ''}<span class="dd-text">${esc(cur ? cur.l : placeholder)}</span>${ic('chev-d', 'chev')}
      </button></div>`;
  },
  ddOpen(wrap) {
    this.ddClose();
    const id = wrap.dataset.dd;
    const opts = (this.ddOpts && this.ddOpts[id]) || [];
    const btn = wrap.querySelector('.dd-btn');
    const cur = wrap.dataset.value;
    const searchable = opts.length > 7;
    const menu = document.createElement('div');
    menu.className = 'dd-menu';
    menu.setAttribute('role', 'listbox');
    menu.innerHTML = (searchable ? `<div class="dd-search"><input type="text" placeholder="Cari..." aria-label="Cari pilihan" autocomplete="off"></div>` : '') +
      `<div class="dd-opts">${opts.map(o => `<button type="button" class="dd-opt" role="option" data-v="${esc(o.v)}" data-s="${esc(o.l.toLowerCase())}" aria-selected="${o.v === cur}">${esc(o.l)}</button>`).join('')}</div>` +
      `<div class="dd-empty" hidden>Tidak ada hasil</div>`;
    wrap.appendChild(menu);
    wrap.classList.add('open');
    btn.setAttribute('aria-expanded', 'true');
    const input = menu.querySelector('input');
    if (input) {
      input.addEventListener('input', () => {
        const q = input.value.trim().toLowerCase();
        let shown = 0;
        menu.querySelectorAll('.dd-opt').forEach(o => { const hit = !q || o.dataset.s.includes(q); o.hidden = !hit; if (hit) shown++; });
        menu.querySelector('.dd-empty').hidden = shown > 0;
      });
      setTimeout(() => input.focus({ preventScroll: true }), 30);
    }
    const sel = menu.querySelector('.dd-opt[aria-selected="true"]');
    if (sel) sel.scrollIntoView({ block: 'nearest' });
  },
  ddClose() {
    document.querySelectorAll('.dropdown.open').forEach(w => {
      w.classList.remove('open');
      const m = w.querySelector('.dd-menu');
      if (m) m.remove();
      const b = w.querySelector('.dd-btn');
      if (b) b.setAttribute('aria-expanded', 'false');
    });
  },
  ddPick(wrap, v) {
    const id = wrap.dataset.dd;
    this.ddClose();
    if (id === 'fStore' && this.draft) { this.keepDraft(); this.draft.store = v; this.renderForm(false); $('#fStore').focus(); return; }
    if (this.fdraft) {
      if (id === 'flArea') {
        this.fdraft.area = v;
        if (v && !this.fdraft.regional) { const s = this.stores.find(x => x.area === v); if (s) this.fdraft.regional = s.regional; }
        if (v && this.fdraft.store && !this.inScope(this.fdraft.store, this.fdraft.regional, v)) this.fdraft.store = '';
      }
      if (id === 'flStore') this.fdraft.store = v;
      if (id === 'flPic') this.fdraft.pic = v;
      this.renderDrawer();
      const b = document.getElementById(id);
      if (b) b.focus();
    }
  },

  /* ---------- filter ---------- */
  openFilter() { this.fdraft = { ...this.filter }; this.openDrawer('filter'); },
  filterHTML() {
    const d = this.fdraft;
    const regs = this.allRegionals().filter(r => !this.access.length || this.access.includes(r));
    if (regs.length < 2) d.regional = '';
    const areas = Array.from(new Set(this.stores.filter(s => this.storeAllowed(s.store) && (!d.regional || s.regional === d.regional)).map(s => s.area).filter(Boolean))).sort();
    const stores = this.storeList().filter(s => this.inScope(s, d.regional, d.area));
    if (!d.regional && !d.area) Array.from(new Set(this.acts.map(a => a.store).filter(Boolean))).filter(s => this.storeAllowed(s) && !stores.includes(s)).forEach(s => stores.push(s));
    const pics = Array.from(new Set(this.acts.filter(a => this.storeAllowed(a.store)).map(a => a.name).filter(Boolean))).sort((a, b) => a.localeCompare(b));
    const all = [{ v: '', l: 'Semua' }];
    const chips = (key, list) => `<div class="chips">${[['', 'Semua']].concat(list.map(x => [x, x])).map(([v, l]) =>
      `<button type="button" class="chipbtn" data-f="${key}" data-v="${esc(v)}" aria-pressed="${d[key] === v}">${esc(l)}</button>`).join('')}</div>`;
    return `
      <section class="card" style="display:flex;flex-direction:column;gap:16px">
        ${regs.length > 1 ? `<div class="field"><span class="label">Regional</span>${chips('regional', regs)}</div>` : ''}
        ${areas.length ? `<div class="field"><span class="label" id="flAreaLabel">Area</span>${this.ddHTML('flArea', all.concat(areas.map(a => ({ v: a, l: a }))), d.area, 'Semua')}</div>` : ''}
        <div class="field"><span class="label">Toko</span>${this.ddHTML('flStore', all.concat(stores.map(s => ({ v: s, l: this.short(s) }))), d.store, 'Semua', 'pin')}</div>
        <div class="field"><span class="label">Jenis kegiatan</span>${chips('type', CONFIG.ACTIVITY_TYPES.map(t => t.key))}</div>
        <div class="field"><span class="label">PIC</span>${this.ddHTML('flPic', all.concat(pics.map(p => ({ v: p, l: p }))), d.pic, 'Semua', 'user')}</div>
      </section>
      <div class="filter-foot">
        <button class="btn-plain" data-act="f-reset">Hapus filter</button>
        <button class="btn-big" data-act="f-apply">Terapkan</button>
      </div>`;
  },

  /* ---------- settings ---------- */
  openSettings() { this.openDrawer('settings'); },
  settingsHTML() {
    const regs = this.allRegionals();
    const activeRegs = this.access.length ? this.access : regs;
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    let install;
    if (this.installed) install = `<div class="install-text"><b>Jadwalin sudah terpasang</b><small>Buka dari layar utama seperti aplikasi biasa.</small></div>`;
    else if (this.installEvt) install = `<div class="install-text"><b>Pasang di layar utama</b><small>Buka seperti aplikasi biasa, bisa tanpa internet.</small></div><button class="btn-pill" data-act="install">Install</button>`;
    else install = `<div class="install-text"><b>Pasang di layar utama</b><small>${ios ? 'Di Safari: tombol Bagikan → “Tambah ke Layar Utama”.' : 'Buka menu browser → “Install aplikasi” atau “Tambahkan ke layar utama”.'}</small></div>`;
    const vis = this.acts.filter(a => this.storeAllowed(a.store)).length;
    return `
      <section class="card profile">
        <div class="avatar">${esc((this.userName || '?').trim().charAt(0).toUpperCase() || '?')}</div>
        <div class="p-body"><div class="p-name">${esc(this.userName || 'Nama belum diisi')}</div><div class="p-sub">Nama untuk setiap kegiatan baru</div></div>
        <button class="round" data-act="edit-name" aria-label="Ubah nama">${ic('pencil')}</button>
        ${this.editingName ? `<form class="name-edit" data-form="name"><input class="input" id="sName" maxlength="${CONFIG.LIMITS.name}" autocomplete="name" placeholder="Nama kamu" value="${esc(this.userName)}" aria-label="Nama kamu"><button type="submit" class="btn-plain">Simpan</button></form>` : ''}
      </section>
      <div class="group">
        <div class="g-label">Tampilan</div>
        <section class="card">
          <div class="srow"><span>Tema</span>
            <div class="seg small" role="group" aria-label="Tema">
              <button data-theme-set="light">Terang</button><button data-theme-set="dark">Gelap</button><button data-theme-set="auto">Otomatis</button>
            </div>
          </div>
          <div class="srow"><span>Warna</span>
            <div class="swatches" role="radiogroup" aria-label="Warna">
              ${Object.entries(CONFIG.PALETTES).map(([k, p]) => `<button class="sw sw-${k}" role="radio" data-pal="${k}">${esc(p.label)}</button>`).join('')}
            </div>
          </div>
        </section>
      </div>
      ${regs.length > 1 ? `
      <div class="group">
        <div class="g-label">Regional yang ditampilkan</div>
        <section class="card"><div class="chips">
          ${regs.map(r => `<button class="chipbtn reg-chip" data-reg="${esc(r)}" aria-pressed="${activeRegs.includes(r)}">${esc(r)}</button>`).join('')}
        </div></section>
      </div>` : ''}
      <div class="group">
        <div class="g-label">Data</div>
        <section class="card">
          <div class="srow"><span>Status</span><b class="${this.connected ? 'ok' : ''}">${this.connected ? 'Terhubung' : 'Belum terhubung'}</b></div>
          <div class="srow"><span>Sinkron terakhir</span><b>${this.lastSync ? new Date(this.lastSync).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}</b></div>
          <div class="srow"><span>Kegiatan tersimpan</span><b>${vis}</b></div>
          <div class="srow"><span>Toko terdaftar</span><b>${this.stores.filter(s => this.storeAllowed(s.store)).length}</b></div>
          <button class="btn-soft" data-act="reload">${ic('refresh')}Muat ulang data</button>
        </section>
      </div>
      <section class="card install"><span class="blob">${ic('download')}</span>${install}</section>
      <div class="group">
        <div class="g-label">Aplikasi</div>
        <section class="card">
          <div class="srow"><span>Versi</span><b>Jadwalin ${esc(CONFIG.APP_VERSION)}</b></div>
          <button class="btn-soft" data-act="clear-cache">${ic('trash')}Bersihkan cache aplikasi</button>
        </section>
      </div>`;
  },
  async clearCache() {
    Sheets.clearCache();
    try {
      if ('caches' in window) { const keys = await caches.keys(); await Promise.all(keys.map(k => caches.delete(k))); }
      if ('serviceWorker' in navigator) { const r = await navigator.serviceWorker.getRegistrations(); await Promise.all(r.map(x => x.unregister())); }
    } catch {}
    this.toast('Cache dibersihkan. Muat ulang halaman untuk versi terbaru.');
  },

  /* ---------- events ---------- */
  bind() {
    $('#calDays').addEventListener('click', (e) => {
      const b = e.target.closest('.day[data-d]');
      if (!b) return;
      this.sel = b.dataset.d;
      if (this.agendaMode !== 'tanggal') { this.agendaMode = 'tanggal'; this.write('jw_agenda', ''); }
      if (this.q) this.setQuery('');
      this.renderCal();
      this.renderSide();
      if (window.innerWidth < 720) {
        const ag = $('#agenda');
        if (ag && ag.getBoundingClientRect().top > window.innerHeight - 80) ag.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
    $('#calPrev').addEventListener('click', () => this.shiftCal(-1));
    $('#calNext').addEventListener('click', () => this.shiftCal(1));
    $('#calMode').addEventListener('click', (e) => {
      const b = e.target.closest('[data-mode]');
      if (!b) return;
      this.calMode = b.dataset.mode;
      this.write('jw_calmode', this.calMode === 'minggu' ? 'minggu' : '');
      this.y = pd(this.sel).getFullYear();
      this.m = pd(this.sel).getMonth();
      this.renderCal();
    });
    $('#calToday').addEventListener('click', () => {
      const t = this.today();
      this.sel = t;
      this.y = pd(t).getFullYear();
      this.m = pd(t).getMonth();
      this.renderCal();
      this.renderSide();
    });

    $('#side').addEventListener('click', (e) => {
      const qa = e.target.closest('[data-qa]');
      if (qa) { this.quickAction(qa); return; }
      const open = e.target.closest('[data-open]');
      if (open) { this.openDetail(open.dataset.open); return; }
      const am = e.target.closest('[data-amode]');
      if (am) { this.agendaMode = am.dataset.amode; this.write('jw_agenda', this.agendaMode === 'bulan' ? 'bulan' : ''); this.renderSide(); return; }
      const act = e.target.closest('[data-act]');
      if (!act) return;
      if (act.dataset.act === 'add-day') this.openForm(null, this.agendaMode === 'tanggal' ? this.sel : undefined);
      if (act.dataset.act === 'nu-all') { this.nuAll = true; this.renderSide(); }
    });

    $('#btnAdd').addEventListener('click', () => this.openForm(null));
    $('#fab').addEventListener('click', () => this.openForm(null));
    $('#btnFilter').addEventListener('click', () => this.openFilter());
    $('#btnSettings').addEventListener('click', () => this.openSettings());
    $('#btnSearch').addEventListener('click', () => {
      const open = !$('#app').classList.contains('search-open');
      $('#app').classList.toggle('search-open', open);
      $('#btnSearch').setAttribute('aria-expanded', String(open));
      if (open) $('#q').focus(); else this.setQuery('');
    });
    $('#q').addEventListener('input', (e) => { this.q = e.target.value; this.renderSide(); });
    $('#q').addEventListener('keydown', (e) => { if (e.key === 'Escape') { this.setQuery(''); e.target.blur(); } });

    $('#scrim').addEventListener('click', () => this.closeOverlay());
    $('#drawerClose').addEventListener('click', () => this.closeOverlay());
    $('#dialogClose').addEventListener('click', () => this.closeOverlay());

    $('#drawerBody').addEventListener('click', (e) => {
      const dd = e.target.closest('.dd-btn');
      if (dd) { e.stopPropagation(); const w = dd.closest('.dropdown'); if (w.classList.contains('open')) this.ddClose(); else this.ddOpen(w); return; }
      const opt = e.target.closest('.dd-opt');
      if (opt) { this.ddPick(opt.closest('.dropdown'), opt.dataset.v); return; }
      if (this.drawerKind === 'detail') {
        const s = e.target.closest('[data-status]');
        if (s) { this.detailStatus(s.dataset.status); return; }
      }
      const f = e.target.closest('[data-f]');
      if (f && this.fdraft) {
        const key = f.dataset.f;
        this.fdraft[key] = f.dataset.v;
        if (key === 'regional') {
          if (this.fdraft.area && !this.stores.some(x => x.area === this.fdraft.area && (!f.dataset.v || x.regional === f.dataset.v))) this.fdraft.area = '';
          if (this.fdraft.store && !this.inScope(this.fdraft.store, this.fdraft.regional, this.fdraft.area)) this.fdraft.store = '';
        }
        this.renderDrawer();
        return;
      }
      const reg = e.target.closest('[data-reg]');
      if (reg) { this.toggleRegional(reg.dataset.reg); return; }
      const act = e.target.closest('[data-act]');
      if (!act) return;
      const a = act.dataset.act;
      if (a === 'edit') { const x = this.acts.find(z => z.id === this.detailId); if (x) { this.drawerKind = null; this.openForm(x); } }
      else if (a === 'del') { this.confirmDel = true; this.renderDrawer(); }
      else if (a === 'cancel-del') { this.confirmDel = false; this.renderDrawer(); }
      else if (a === 'do-del') this.deleteDetail();
      else if (a === 'f-apply') { this.filter = { ...this.fdraft }; this.fdraft = null; this.closeOverlay(); this.render(); }
      else if (a === 'f-reset') { this.fdraft = { regional: '', area: '', store: '', type: '', pic: '' }; this.renderDrawer(); }
      else if (a === 'edit-name') { this.editingName = !this.editingName; this.renderDrawer(); const n = $('#sName'); if (n) n.focus(); }
      else if (a === 'reload') { act.disabled = true; this.load(true).then(ok => { if (ok) this.toast('Data diperbarui'); if (this.drawerKind === 'settings') this.renderDrawer(); }); }
      else if (a === 'install') this.promptInstall();
      else if (a === 'clear-cache') this.clearCache();
    });
    $('#drawerBody').addEventListener('submit', (e) => {
      if (!e.target.matches('[data-form="name"]')) return;
      e.preventDefault();
      const v = $('#sName').value.trim();
      if (!v) { this.toast('Nama tidak boleh kosong.'); return; }
      this.userName = v.slice(0, CONFIG.LIMITS.name);
      this.write('jw_name', this.userName);
      this.editingName = false;
      this.renderTop();
      this.renderDrawer();
      this.toast('Nama disimpan');
    });

    $('#dialogBody').addEventListener('click', (e) => {
      const dd = e.target.closest('.dd-btn');
      if (dd) { e.stopPropagation(); const w = dd.closest('.dropdown'); if (w.classList.contains('open')) this.ddClose(); else this.ddOpen(w); return; }
      const opt = e.target.closest('.dd-opt');
      if (opt) { this.ddPick(opt.closest('.dropdown'), opt.dataset.v); return; }
      const d = this.draft;
      if (!d) return;
      const tile = e.target.closest('[data-type]');
      if (tile) {
        if (tile.dataset.type === d.type) return;
        this.keepDraft();
        d.type = tile.dataset.type;
        if (!this.numberField(this.type(d.type))) d.k2 = '';
        this.formError = '';
        this.renderForm(true);
        return;
      }
      const chip = e.target.closest('[data-date]');
      if (chip) {
        this.keepDraft();
        const t = this.today(), tmr = addDays(t, 1);
        if (chip.dataset.date === 'today') d.date = t;
        else if (chip.dataset.date === 'tomorrow') d.date = tmr;
        else if (d.date === t || d.date === tmr) d.date = addDays(t, 2);
        this.renderForm(false);
        if (chip.dataset.date === 'other') { const di = $('#fDate'); if (di) { di.focus(); try { di.showPicker(); } catch {} } }
        return;
      }
      const step = e.target.closest('[data-step]');
      if (step) {
        const inp = $('#fK2');
        const v = Math.max(0, Math.min(99999, (parseInt(inp.value, 10) || 0) + Number(step.dataset.step)));
        inp.value = v;
        d.k2 = String(v);
        return;
      }
      const act = e.target.closest('[data-act]');
      if (act && act.dataset.act === 'ask-name') { this.keepDraft(); d.askName = true; this.renderForm(false); const n = $('#fName'); if (n) n.focus(); }
    });
    $('#dialogBody').addEventListener('input', () => {
      if (!this.formError) return;
      this.formError = '';
      const box = $('#dialogBody .form-error');
      if (box) box.remove();
    });
    $('#dialogBody').addEventListener('change', (e) => {
      if (e.target.id === 'fDate' && e.target.value && this.draft) { this.keepDraft(); this.draft.date = e.target.value; this.renderForm(false); }
    });
    $('#dialog').addEventListener('submit', (e) => { e.preventDefault(); this.saveForm(); });

    document.addEventListener('click', (e) => {
      if (!e.target.closest('.dropdown')) this.ddClose();
      const th = e.target.closest('[data-theme-set]');
      if (th) { this.setTheme(th.dataset.themeSet); return; }
      const pa = e.target.closest('[data-pal]');
      if (pa) this.setPalette(pa.dataset.pal);
    });
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      if (document.querySelector('.dropdown.open')) { this.ddClose(); return; }
      if (this.overlay) this.closeOverlay();
    });
    window.addEventListener('popstate', () => {
      if (this.skipPop) { this.skipPop = false; return; }
      if (this.overlay) { this.pushed = false; this.closeOverlay(true); }
    });
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => this.applyTheme());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) return;
      this.render();
      if (!this.overlay && this.lastSync && Date.now() - this.lastSync > 5 * 60 * 1000) this.load(true);
    });

    this.installed = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.installEvt = e;
      if (this.drawerKind === 'settings') this.renderDrawer();
    });
    window.addEventListener('appinstalled', () => {
      this.installEvt = null;
      this.installed = true;
      if (this.drawerKind === 'settings') this.renderDrawer();
    });
  },
  setQuery(v) {
    this.q = v;
    $('#q').value = v;
    this.renderSide();
  },
  shiftCal(dir) {
    if (this.calMode === 'minggu') {
      this.sel = addDays(this.sel, dir * 7);
      this.y = pd(this.sel).getFullYear();
      this.m = pd(this.sel).getMonth();
    } else {
      const x = new Date(this.y, this.m + dir, 1);
      this.y = x.getFullYear();
      this.m = x.getMonth();
    }
    this.renderCal();
    this.renderSide();
  },
  toggleRegional(r) {
    const regs = this.allRegionals();
    const cur = new Set(this.access.length ? this.access : regs);
    if (cur.has(r)) cur.delete(r); else cur.add(r);
    if (!cur.size) { this.toast('Pilih minimal satu regional.'); return; }
    this.setAccess(cur.size === regs.length ? [] : Array.from(cur));
    if (this.filter.regional && !cur.has(this.filter.regional)) this.filter.regional = '';
    if (this.filter.store && !this.storeAllowed(this.filter.store)) this.filter.store = '';
    this.render();
    this.renderDrawer();
  },
  async promptInstall() {
    const e = this.installEvt;
    if (!e) return;
    e.prompt();
    try { await e.userChoice; } catch {}
    this.installEvt = null;
    if (this.drawerKind === 'settings') this.renderDrawer();
  },

  /* ---------- splash & toast ---------- */
  showSplash() {
    $('#splash').classList.remove('hidden');
    $('#splashMsg').innerHTML = 'Memuat data<span class="loading-dots"></span>';
  },
  hideSplash() { setTimeout(() => $('#splash').classList.add('hidden'), 150); },
  splashError(msg) {
    $('#splash').classList.remove('hidden');
    $('#splashMsg').innerHTML = `Gagal memuat data: ${esc(msg)}<br><button class="btn-plain" id="splashRetry">Coba lagi</button>`;
    $('#splashRetry').addEventListener('click', () => this.load(false));
  },
  toast(msg) {
    const t = $('#toast');
    t.hidden = true;
    void t.offsetWidth;
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => { t.hidden = true; }, 3200);
  }
};

document.addEventListener('DOMContentLoaded', () => App.init());

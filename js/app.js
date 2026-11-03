

const $ = (s) => document.querySelector(s);
const pad2 = (n) => String(n).padStart(2, '0');
const pd = (d) => { const [y, m, dd] = String(d).split('-').map(Number); return new Date(y, m - 1, dd); };
const fmt = (x) => x.getFullYear() + '-' + pad2(x.getMonth() + 1) + '-' + pad2(x.getDate());
const addDays = (d, n) => { const x = pd(d); x.setDate(x.getDate() + n); return fmt(x); };
// Minggu dimulai hari Minggu.
const weekStart = (d) => { const x = pd(d); x.setDate(x.getDate() - x.getDay()); return fmt(x); };
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ic = (n, cls) => `<svg class="i${cls ? ' ' + cls : ''}" aria-hidden="true"><use href="#i-${n}"/></svg>`;
const PHONE_RE = /^[0-9+()\-.\s]{6,}$/;
const SLOTS = ['k1', 'k2', 'picName', 'picPhone', 'note'];

const App = {
  acts: [], stores: [], contacts: [], storeMeta: {}, storeIndex: {},
  access: [],
  filter: { regional: '', area: '', store: '', type: '', pic: '' },
  sel: '', y: 0, m: 0,
  calMode: 'bulan', nuAll: false, view: 'home', listY: 0, listM: 0, listPushed: false, homeScroll: 0,
  theme: 'auto', palette: 'mint', userName: '', lastStore: '',
  lastSync: null, connected: false,
  overlay: null, drawerKind: null, dialogKind: null, dayDate: '', detailId: null, confirmDel: false, busy: false,
  navStack: [], pushDepth: 0,
  draft: null, formError: '', fdraft: null, editingName: false, searchOpen: false,
  installEvt: null, installed: false,

  async init() {
    this.loadSettings();
    this.applyTheme();
    const t = this.today();
    this.sel = t;
    this.y = pd(t).getFullYear();
    this.m = pd(t).getMonth();

    const params = new URLSearchParams(location.search);

    this.bind();

    const ca = Sheets.loadList(Sheets.CACHE_KEY_ACTIVITY);
    const cs = Sheets.loadList(Sheets.CACHE_KEY_STORE);
    const ck = Sheets.loadList(Sheets.CACHE_KEY_KONTAK);
    if (ca) {
      this.stores = cs ? cs.data : [];
      this.contacts = ck ? ck.data : [];
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
    else if (params.get('view') === 'bulan') this.openList();
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
  setUserName(v) { this.userName = String(v || '').trim().slice(0, CONFIG.LIMITS.name); this.write('jw_name', this.userName); this.renderTop(); },

  /* ---------- data ---------- */
  async load(silent) {
    if (!silent) this.showSplash();
    try {
      const res = await Sheets.fetchAll();
      this.stores = Array.isArray(res.toko) ? res.toko : [];
      this.acts = Array.isArray(res.kegiatan) ? res.kegiatan : [];
      if (Array.isArray(res.kontak)) this.contacts = res.kontak;
      this.lastSync = Date.now();
      this.connected = true;
      this.buildStores();
      Sheets.saveList(Sheets.CACHE_KEY_ACTIVITY, this.acts);
      Sheets.saveList(Sheets.CACHE_KEY_STORE, this.stores);
      Sheets.saveList(Sheets.CACHE_KEY_KONTAK, this.contacts);
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
    const str = (v) => String(v == null ? '' : v).trim();
    return {
      id: str(a.id), date: str(a.date), name: str(a.name), store: this.canonStore(a.store), type: str(a.type),
      k1: str(a.k1), k2: str(a.k2), picName: str(a.picName), picPhone: str(a.picPhone), note: str(a.note),
      status, updatedAt: str(a.updatedAt)
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
  contactOf(name) {
    const n = String(name || '').trim().toLowerCase();
    return n ? this.contacts.find(c => String(c.name).toLowerCase() === n) : null;
  },
  rememberContact(name, phone, store) {
    if (!name) return;
    const c = this.contactOf(name);
    if (c) { if (phone) c.phone = phone; if (store) c.store = store; }
    else this.contacts.push({ name, phone: phone || '', store: store || '' });
    Sheets.saveList(Sheets.CACHE_KEY_KONTAK, this.contacts);
  },

  today() { return fmt(new Date()); },
  type(key) { return CONFIG.ACTIVITY_TYPES.find(t => t.key === key) || null; },
  fieldsOf(key) { const t = this.type(key); return t ? t.fields : CONFIG.GENERIC_FIELDS; },
  hue(key) { const t = this.type(key); return `--hue:var(${t ? t.colorVar : '--ink-3'})`; },
  typeOrder(key) { const i = CONFIG.ACTIVITY_TYPES.findIndex(t => t.key === key); return i < 0 ? 99 : i; },
  titleOf(a) { return a.k1 || a.type || 'Kegiatan'; },
  byDate(a, b) { return a.date.localeCompare(b.date) || App.typeOrder(a.type) - App.typeOrder(b.type) || App.titleOf(a).localeCompare(App.titleOf(b)); },
  dShort(d) { const x = pd(d); return CONFIG.DAYS_SHORT[x.getDay()] + ', ' + x.getDate() + ' ' + CONFIG.MONTHS_SHORT[x.getMonth()]; },
  dFull(d) { const x = pd(d); return CONFIG.DAYS[x.getDay()] + ', ' + x.getDate() + ' ' + CONFIG.MONTHS[x.getMonth()] + ' ' + x.getFullYear(); },
  stamp(s) {
    const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
    if (!m) return s || '—';
    return Number(m[3]) + ' ' + CONFIG.MONTHS_SHORT[Number(m[2]) - 1] + ' ' + m[1] + ', ' + m[4] + '.' + m[5];
  },
  waNumber(p) {
    let d = String(p || '').replace(/[^\d+]/g, '');
    if (d.startsWith('+')) d = d.slice(1);
    d = d.replace(/\D/g, '');
    if (d.startsWith('0')) d = '62' + d.slice(1);
    else if (d.startsWith('8')) d = '62' + d;
    return d;
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
    if (this.view === 'list') this.renderList();
    if (this.searchOpen) this.renderSearch();
    if (this.overlay === 'drawer' && this.drawerKind !== 'filter') this.renderDrawer();
    if (this.overlay === 'dialog' && this.dialogKind === 'day') this.renderDay();
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

  /* ---------- calendar (minggu dimulai hari Minggu) ---------- */
  calCells() {
    if (this.calMode === 'minggu') {
      const ws = weekStart(this.sel);
      return Array.from({ length: 7 }, (_, i) => addDays(ws, i));
    }
    const off = new Date(this.y, this.m, 1).getDay();
    const dim = new Date(this.y, this.m + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < off; i++) cells.push(null);
    for (let d = 1; d <= dim; d++) cells.push(fmt(new Date(this.y, this.m, d)));
    return cells;
  },
  weekNo(ds) {
    const x = pd(ds);
    return Math.floor((x.getDate() - 1 + new Date(x.getFullYear(), x.getMonth(), 1).getDay()) / 7) + 1;
  },
  // Urutan tanda di tanggal: jenis kegiatan yang berbeda didahulukan, yang batal paling akhir.
  slotOrder(items) {
    const sorted = items.slice().sort((a, b) =>
      (a.status === 'Batal') - (b.status === 'Batal') || this.typeOrder(a.type) - this.typeOrder(b.type) || this.titleOf(a).localeCompare(this.titleOf(b)));
    const firsts = [], rest = [], seen = new Set();
    sorted.forEach(a => { if (seen.has(a.type)) rest.push(a); else { seen.add(a.type); firsts.push(a); } });
    return firsts.concat(rest);
  },
  renderCal() {
    const t = this.today();
    const week = this.calMode === 'minggu';
    const byDay = {};
    this.visible().forEach(a => { (byDay[a.date] = byDay[a.date] || []).push(a); });
    const maxEv = week ? 9 : 2;
    $('#calDays').classList.toggle('week', week);
    $('#calDays').innerHTML = this.calCells().map(ds => {
      if (!ds) return '<span class="day blank"></span>';
      const order = this.slotOrder(byDay[ds] || []);
      // Titik: maksimal 3 tanda; jika lebih dari 3 kegiatan, tanda ketiga menjadi +N.
      const dotList = order.length > 3 ? order.slice(0, 2) : order;
      const dots = dotList.map(a => `<i class="${a.status === 'Batal' ? 'off' : ''}" style="${this.hue(a.type)}"></i>`).join('')
        + (order.length > 3 ? `<b>+${order.length - 2}</b>` : '');
      const evs = order.slice(0, maxEv).map(a =>
        `<span class="ev hue${a.status === 'Batal' ? ' off' : ''}" style="${this.hue(a.type)}">${a.status === 'Selesai' ? '✓ ' : ''}${esc(this.titleOf(a))}</span>`).join('');
      const more = order.length > maxEv ? `<span class="more">+${order.length - maxEv}</span>` : '';
      const cls = ['day'];
      if (ds === t) cls.push('today'); else if (ds < t) cls.push('past');
      if (ds === this.sel) cls.push('sel');
      const label = this.dFull(ds) + (order.length ? ', ' + order.length + ' kegiatan' : '');
      return `<button class="${cls.join(' ')}" data-d="${ds}" aria-label="${label}" aria-pressed="${ds === this.sel}">
        <span class="day-top"><span class="n">${pd(ds).getDate()}</span>${more}</span>
        <span class="dots">${dots}</span><span class="evs">${evs}</span></button>`;
    }).join('');
    const month = CONFIG.MONTHS[this.m] + ' ' + this.y;
    $('#calTitle').innerHTML = week ? `Minggu ${this.weekNo(this.sel)}<small>${esc(month)}</small>` : esc(month);
    $('#calPrev').setAttribute('aria-label', week ? 'Minggu sebelumnya' : 'Bulan sebelumnya');
    $('#calNext').setAttribute('aria-label', week ? 'Minggu berikutnya' : 'Bulan berikutnya');
    document.querySelectorAll('#calMode [data-mode]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mode === this.calMode)));
    const tp = pd(t);
    const viewingToday = week ? weekStart(this.sel) === weekStart(t) : (this.y === tp.getFullYear() && this.m === tp.getMonth());
    $('#calToday').hidden = viewingToday && this.sel === t;
  },
  setMonthOf(ds) { const x = pd(ds); this.y = x.getFullYear(); this.m = x.getMonth(); },
  setCalMode(mode) {
    if (mode === this.calMode) return;
    if (mode === 'minggu') {
      const sp = pd(this.sel);
      if (sp.getFullYear() !== this.y || sp.getMonth() !== this.m) {
        const t = this.today(), tp = pd(t);
        this.sel = tp.getFullYear() === this.y && tp.getMonth() === this.m ? t : fmt(new Date(this.y, this.m, 1));
      }
    }
    this.calMode = mode;
    this.write('jw_calmode', mode === 'minggu' ? 'minggu' : '');
    this.setMonthOf(this.sel);
    this.renderCal();
  },
  shiftCal(dir) {
    if (this.calMode === 'minggu') {
      this.sel = addDays(this.sel, dir * 7);
      this.setMonthOf(this.sel);
    } else {
      const x = new Date(this.y, this.m + dir, 1);
      this.y = x.getFullYear();
      this.m = x.getMonth();
    }
    this.renderCal();
  },

  /* ---------- side panel ---------- */
  // withIcon: di pop up tanggal, tanggalnya sama semua, jadi kotak kiri diganti ikon jenis kegiatan.
  card(a, withIcon) {
    const t = this.today();
    const x = pd(a.date);
    const ty = this.type(a.type);
    const lead = withIcon
      ? `<span class="date-b hue type-b">${ic(ty ? ty.icon : 'tag')}</span>`
      : `<span class="date-b hue"><b>${x.getDate()}</b><small>${CONFIG.DAYS_SHORT[x.getDay()]}</small></span>`;
    let pill = '';
    if (a.status === 'Selesai') pill = `<span class="pill hue h-ok">Selesai</span>`;
    else if (a.status === 'Batal') pill = `<span class="pill hue h-bad">Batal</span>`;
    else if (a.date < t && a.status === 'Terjadwal') pill = `<span class="pill hue h-warn">Perlu update</span>`;
    else if (a.status !== 'Terjadwal') pill = `<span class="pill hue h-primary">${esc(a.status)}</span>`;
    return `<button class="act${a.status === 'Batal' ? ' is-batal' : ''}" style="${this.hue(a.type)}" data-open="${esc(a.id)}">
      ${lead}
      <span class="act-body">
        <span class="act-top"><span class="chip hue">${esc(a.type || '—')}</span>${pill}</span>
        <span class="act-title">${esc(this.titleOf(a))}</span>
        <span class="act-meta">${esc(this.short(a.store))}</span>
      </span>${ic('chev-r')}</button>`;
  },
  needsCard() {
    const list = this.needList();
    if (!list.length) return '';
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
    return `<section class="card nu" aria-label="Perlu update">
      <div class="sec-head"><span class="sec-title">Perlu update</span><span class="count">${list.length}</span></div>
      <p class="sec-sub">Sudah lewat tapi masih terjadwal. Sudah terlaksana?</p>
      <div class="nu-list">${rows}${more}</div>
    </section>`;
  },
  renderSide() {
    const html = this.needsCard();
    $('#side').innerHTML = html;
    $('#side').hidden = !html;
    $('#main').classList.toggle('solo', !html && this.view !== 'list');
  },

  /* ---------- pop up kegiatan di tanggal ---------- */
  openDay(ds) {
    this.dayDate = ds;
    this.dialogKind = 'day';
    this.draft = null;
    this.formError = '';
    this.showOverlay('dialog');
    this.renderDay();
  },
  renderDay() {
    const ds = this.dayDate;
    const items = this.visible().filter(a => a.date === ds).sort((a, b) => this.byDate(a, b));
    $('#dialogTitle').textContent = this.dFull(ds);
    $('#dialogBody').innerHTML = `
      <div class="day-list">${items.length ? items.map(a => this.card(a, true)).join('')
        : `<div class="empty"><span class="blob">${ic('cal')}</span><p>Belum ada kegiatan di tanggal ini.</p></div>`}</div>
      <div class="row2 day-actions">
        <button type="button" class="btn-soft day-go" data-act="day-list">${ic('list')}Daftar kegiatan</button>
        <button type="button" class="btn-soft day-add" data-act="day-add">${ic('plus')}Tambah</button>
      </div>`;
  },

  /* ---------- daftar kegiatan (sebulan, di halaman) ---------- */
  openList(fromDate) {
    if (this.view === 'list') return;
    const base = fromDate ? pd(fromDate) : new Date(this.y, this.m, 1);
    if (this.overlay) {
      // Dibuka dari pop up tanggal: entri riwayat pop up dipakai untuk tampilan daftar.
      const reuse = this.pushDepth > 0;
      this.navStack = [];
      this.closeOverlay(true);
      this.listPushed = reuse;
    } else {
      try { history.pushState({ jwList: true }, ''); this.listPushed = true; } catch { this.listPushed = false; }
    }
    this.homeScroll = window.scrollY;
    this.listY = base.getFullYear();
    this.listM = base.getMonth();
    this.view = 'list';
    this.applyView();
    window.scrollTo(0, 0);
  },
  closeList(fromPop) {
    if (this.view !== 'list') return;
    this.view = 'home';
    this.applyView();
    if (!fromPop && this.listPushed) { this.skipPop = true; history.back(); }
    this.listPushed = false;
    window.scrollTo(0, this.homeScroll || 0);
  },
  applyView() {
    const list = this.view === 'list';
    $('#app').classList.toggle('view-list', list);
    $('#listView').hidden = !list;
    $('#btnList').setAttribute('aria-pressed', String(list));
    if (list) this.renderList(); else $('#listView').innerHTML = '';
    this.renderSide();
  },
  renderList() {
    $('#listView').innerHTML = `<div class="lv-head">
        <button class="round" data-act="list-close" aria-label="Kembali">${ic('chev-l')}</button>
        <h2>Daftar kegiatan</h2>
      </div>` + this.listHTML();
  },
  listHTML() {
    const t = this.today();
    const key = this.listY + '-' + pad2(this.listM + 1);
    const rows = this.visible().filter(a => a.date.slice(0, 7) === key);
    const up = rows.filter(a => a.date >= t).sort((a, b) => this.byDate(a, b));
    const past = rows.filter(a => a.date < t).sort((a, b) => this.byDate(b, a));
    let html = `<div class="list-nav">
        <button class="mini-round" data-act="list-prev" aria-label="Bulan sebelumnya">${ic('chev-l')}</button>
        <div class="list-month"><b>${CONFIG.MONTHS[this.listM]} ${this.listY}</b><small>${rows.length} kegiatan</small></div>
        <button class="mini-round" data-act="list-next" aria-label="Bulan berikutnya">${ic('chev-r')}</button>
      </div>`;
    if (!rows.length) html += `<div class="empty"><span class="blob">${ic('cal')}</span><p>Belum ada kegiatan di bulan ini.</p></div>`;
    if (up.length) html += `<div class="list-group"><span>Akan dilaksanakan</span><span>${up.length}</span></div>` + up.map(a => this.card(a)).join('');
    if (past.length) html += `<div class="list-group"><span>Sudah dilaksanakan</span><span>${past.length}</span></div>` + past.map(a => this.card(a)).join('');
    return `<div class="agenda">${html}</div>`;
  },

  /* ---------- search (melayang di bawah tombol cari) ---------- */
  openSearch() {
    this.searchOpen = true;
    this.showEl($('#searchPop'));
    $('#btnSearch').setAttribute('aria-expanded', 'true');
    this.renderSearch();
    setTimeout(() => $('#q').focus({ preventScroll: true }), 30);
  },
  closeSearch() {
    if (!this.searchOpen) return;
    this.searchOpen = false;
    this.hideEl($('#searchPop'), () => { $('#q').value = ''; });
    $('#btnSearch').setAttribute('aria-expanded', 'false');
  },
  renderSearch() {
    const raw = $('#q').value.trim();
    const q = raw.toLowerCase();
    const box = $('#searchResults');
    if (!q) { box.innerHTML = '<div class="search-note">Ketik nama kegiatan, toko, atau PIC.</div>'; return; }
    const t = this.today();
    const hits = this.visible().filter(a => [this.titleOf(a), a.store, a.name, a.type, a.picName, a.note, a.k2].join(' ').toLowerCase().includes(q));
    const up = hits.filter(a => a.date >= t).sort((a, b) => this.byDate(a, b));
    const past = hits.filter(a => a.date < t).sort((a, b) => this.byDate(b, a));
    box.innerHTML = hits.length
      ? up.concat(past).slice(0, 50).map(a => this.card(a)).join('')
      : `<div class="search-note">Tidak ada kegiatan yang cocok dengan “${esc(raw)}”.</div>`;
  },

  /* ---------- show / hide with transitions ---------- */
  reduceMotion() { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; },
  showEl(el) {
    clearTimeout(el._hideT);
    el.classList.remove('out');
    if (el.hidden) {
      el.hidden = false;
      el.classList.remove('anim');
      void el.offsetWidth;
      el.classList.add('anim');
    }
  },
  hideEl(el, done) {
    if (el.hidden) { if (done) done(); return; }
    if (this.reduceMotion()) { el.hidden = true; if (done) done(); return; }
    el.classList.remove('anim');
    el.classList.add('out');
    clearTimeout(el._hideT);
    el._hideT = setTimeout(() => { el.hidden = true; el.classList.remove('out'); if (done) done(); }, 220);
  },

  /* ---------- overlays ---------- */
  showOverlay(which) {
    const wasOpen = !!this.overlay;
    if (!wasOpen) this.lastFocus = document.activeElement;
    if (this.searchOpen) this.closeSearch();
    const el = which === 'drawer' ? $('#drawer') : $('#dialog');
    const other = which === 'drawer' ? $('#dialog') : $('#drawer');
    this.hideEl(other);
    if (this.overlay !== which) { el.scrollTop = 0; $('#drawerBody').scrollTop = 0; }
    this.showEl(el);
    this.showEl($('#scrim'));
    document.body.classList.add('locked');
    if (!wasOpen) {
      this.navStack = [];
      this.pushDepth = 0;
      try { history.pushState({ jwOverlay: true }, ''); this.pushDepth = 1; } catch {}
    }
    this.overlay = which;
  },
  // Simpan tampilan sekarang (pop up tanggal / daftar) supaya tombol kembali membuka tampilan itu lagi.
  navPush() {
    let v = null;
    if (this.overlay === 'dialog' && this.dialogKind === 'day') v = { overlay: 'dialog', kind: 'day', date: this.dayDate };
    if (!v) return;
    this.navStack.push(v);
    try { history.pushState({ jwOverlay: true }, ''); this.pushDepth++; } catch {}
  },
  closeOverlay(fromPop) {
    if (!this.overlay) return;
    if (fromPop) this.pushDepth = Math.max(0, this.pushDepth - 1);
    const back = this.navStack.pop();
    this.confirmDel = false;
    this.editingName = false;
    this.draft = null;
    this.formError = '';
    if (back) {
      if (!fromPop && this.pushDepth > 1) { this.pushDepth--; this.skipPop = true; history.back(); }
      this.dialogKind = 'day';
      this.dayDate = back.date;
      this.showOverlay('dialog');
      this.renderDay();
      return;
    }
    this.hideEl($('#drawer'));
    this.hideEl($('#dialog'));
    this.hideEl($('#scrim'));
    document.body.classList.remove('locked');
    this.overlay = null;
    this.drawerKind = null;
    this.dialogKind = null;
    if (!fromPop && this.pushDepth > 0) { this.skipPop = true; history.go(-this.pushDepth); }
    this.pushDepth = 0;
    this.navStack = [];
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
  openDetail(id) { this.navPush(); this.detailId = id; this.openDrawer('detail'); },
  detailHTML(a) {
    const t = this.type(a.type);
    const rows = [['pin', 'Toko', esc(a.store || '—')]];
    this.fieldsOf(a.type).forEach(f => {
      if (f.slot === 'k1') return;
      const v = a[f.slot];
      if (f.type === 'number') { rows.push([f.icon || 'people', f.label, v ? esc(v) + ' orang' : '—']); return; }
      if (!v) return;
      if (f.type === 'tel') {
        rows.push([f.icon || 'phone', f.label, `<a class="wa-link" href="https://wa.me/${esc(this.waNumber(v))}" target="_blank" rel="noopener">${esc(v)}${ic('chat')}</a>`]);
        return;
      }
      rows.push([f.icon || 'tag', f.label, esc(v), f.type === 'textarea']);
    });
    rows.push(['pencil', 'Dicatat oleh', esc(a.name || '—')]);
    rows.push(['clock', 'Terakhir diubah', esc(a.updatedAt ? this.stamp(a.updatedAt) : '—')]);
    const dis = this.busy ? ' disabled' : '';
    return `
      <section class="hero" style="${this.hue(a.type)}">
        <span class="ib">${ic(t ? t.icon : 'cal')}</span>
        <span class="chip">${esc(a.type || 'Kegiatan')}</span>
        <h3>${esc(this.titleOf(a))}</h3>
        <div class="when">${this.dFull(a.date)}</div>
      </section>
      <section class="card info">${rows.map(([i, k, v, multi]) => `
        <div class="info-row"><span class="ii">${ic(i)}</span><div><div class="k">${esc(k)}</div><div class="v${multi ? ' multi' : ''}">${v}</div></div></div>`).join('')}
      </section>
      <div class="field">
        <span class="label" style="padding-left:6px">Status</span>
        <div class="status3" role="group" aria-label="Status kegiatan">
          ${[['Terjadwal', 'clock', 'h-primary'], ['Selesai', 'check', 'h-ok'], ['Batal', 'x', 'h-bad']].map(([s, i, h]) => `
            <button class="sbtn ${h}" data-status="${s}" aria-pressed="${a.status === s}"${dis}><span class="ib">${ic(i)}</span>${s}</button>`).join('')}
        </div>
      </div>
      <div class="row2">
        <a class="btn-soft wa" href="${esc(this.shareLink(a))}" target="_blank" rel="noopener">${ic('chat')}Bagikan</a>
        <button class="btn-soft" data-act="edit"${dis}>${ic('pencil')}Ubah</button>
      </div>
      ${this.confirmDel ? `
        <div class="confirm" role="alertdialog" aria-label="Konfirmasi hapus">
          <p>Hapus “${esc(this.titleOf(a))}”?<small>Kegiatan ini dipindah ke sheet Sampah di spreadsheet.</small></p>
          <div class="row2"><button class="btn-plain" data-act="cancel-del"${dis}>Batal</button><button class="btn-bad" data-act="do-del"${dis}>${this.busy ? 'Menghapus...' : 'Hapus'}</button></div>
        </div>` : `<button class="btn-text" data-act="del"${dis}>${ic('trash')}Hapus kegiatan</button>`}`;
  },
  shareLink(a) {
    const t = this.type(a.type);
    const lines = ['*Agenda Jadwalin*', (a.type ? a.type + ' · ' : '') + this.titleOf(a), this.dFull(a.date), a.store];
    this.fieldsOf(a.type).forEach(f => {
      if (['k1', 'picName', 'picPhone', 'note'].includes(f.slot) || !a[f.slot]) return;
      lines.push(f.label + ': ' + a[f.slot]);
    });
    if (a.picName || a.picPhone) lines.push('PIC: ' + [a.picName, a.picPhone].filter(Boolean).join(' · '));
    if (a.note && (!t || t.fields.some(f => f.slot === 'note'))) lines.push('Keterangan: ' + a.note);
    lines.push('Status: ' + a.status);
    return 'https://wa.me/?text=' + encodeURIComponent(lines.filter(Boolean).join('\n'));
  },
  rowOf(a) {
    const row = { date: a.date, name: a.name, store: a.store, type: a.type, status: a.status };
    SLOTS.forEach(k => { row[k] = a[k] || ''; });
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
      await Sheets.deleteActivity(a.id, this.userName);
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
      this.draft = { editId: a.id, type: a.type, date: a.date, store: a.store, name: a.name || this.userName, status: a.status };
      SLOTS.forEach(k => { this.draft[k] = a[k] || ''; });
    } else {
      const d = date || this.sel || t;
      const store = this.filter.store || (this.storeList().includes(this.lastStore) ? this.lastStore : '');
      this.draft = { editId: null, type: this.filter.type || CONFIG.ACTIVITY_TYPES[0].key, date: d, store, name: this.userName, status: 'Terjadwal' };
      SLOTS.forEach(k => { this.draft[k] = ''; });
    }
    this.draft.step = this.draft.name ? 'form' : 'name';
    this.formError = '';
    this.dialogKind = 'form';
    this.showOverlay('dialog');
    this.renderForm(false);
    if (window.matchMedia('(pointer: fine)').matches) {
      setTimeout(() => { const el = $('#dialog').querySelector(this.draft && this.draft.step === 'name' ? '#fName' : '#f_k1'); if (el) el.focus({ preventScroll: true }); }, 80);
    }
  },
  keepDraft() {
    const d = this.draft;
    if (!d || d.step !== 'form') return;
    SLOTS.forEach(k => { const el = document.getElementById('f_' + k); if (el) d[k] = el.value; });
    const date = document.getElementById('fDate'); if (date) d.date = date.value;
    const st = document.getElementById('fStoreText'); if (st) d.store = st.value;
  },
  fieldHTML(f, d) {
    const id = 'f_' + f.slot;
    const label = `<label class="label" for="${id}">${esc(f.label)}</label>`;
    const val = esc(d[f.slot]);
    if (f.type === 'number') {
      return `<div class="field">${label}<div class="stepper">
          <button type="button" data-step="-1" aria-label="Kurangi">${ic('minus')}</button>
          <input id="${id}" type="number" inputmode="numeric" min="0" max="99999" value="${val}">
          <button type="button" data-step="1" aria-label="Tambah">${ic('plus')}</button>
        </div></div>`;
    }
    if (f.type === 'textarea') {
      return `<div class="field wide-field">${label}<textarea class="input" id="${id}" rows="3" maxlength="${f.max || 300}">${val}</textarea></div>`;
    }
    if (f.type === 'tel') {
      return `<div class="field">${label}<input class="input" id="${id}" type="tel" inputmode="tel" autocomplete="off" maxlength="${f.max || 30}" value="${val}"></div>`;
    }
    return `<div class="field">${label}<input class="input" id="${id}" maxlength="${f.max || 140}" autocomplete="off" value="${val}"></div>`;
  },
  renderForm(popType) {
    const d = this.draft;
    if (d.step === 'name') {
      $('#dialogTitle').textContent = 'Kenalan dulu';
      $('#dialogBody').innerHTML = `
        <div class="name-step">
          <span class="blob">${ic('user')}</span>
          <p>Isi nama kamu dulu. Nama ini dicatat di setiap kegiatan yang kamu tambahkan.</p>
          <div class="field"><label class="label" for="fName">Nama kamu</label>
            <input class="input" id="fName" maxlength="${CONFIG.LIMITS.name}" autocomplete="name" value=""></div>
          ${this.formError ? `<div class="form-error" role="alert">${esc(this.formError)}</div>` : ''}
          <button type="submit" class="btn-big" id="fSave">Lanjut</button>
        </div>`;
      return;
    }
    const edit = !!d.editId;
    const types = CONFIG.ACTIVITY_TYPES.slice();
    if (d.type && !this.type(d.type)) types.push({ key: d.type, icon: 'tag' });
    const tiles = types.map(x => `
      <button type="button" class="tile${popType && x.key === d.type ? ' pop' : ''}" style="${this.hue(x.key)}" data-type="${esc(x.key)}" aria-pressed="${x.key === d.type}">
        <span class="ib hue">${ic(x.icon)}</span><b>${esc(x.key)}</b>
      </button>`).join('');
    const stores = this.storeList();
    if (d.store && !stores.includes(d.store)) stores.unshift(d.store);
    const storeField = stores.length
      ? this.ddHTML('fStore', stores.map(s => ({ v: s, l: this.short(s) })), d.store, 'Pilih toko', 'pin')
      : `<input class="input" id="fStoreText" maxlength="120" value="${esc(d.store)}" autocomplete="off" aria-label="Toko">`;

    $('#dialogTitle').textContent = edit ? 'Ubah kegiatan' : 'Kegiatan baru';
    $('#dialogBody').innerHTML = `
      <div class="field"><span class="label">Jenis kegiatan</span><div class="tiles">${tiles}</div></div>
      <div class="form-grid">
        <div class="field"><label class="label" for="fDate">Tanggal</label><input class="input" type="date" id="fDate" value="${esc(d.date)}"></div>
        <div class="field"><span class="label" id="fStoreLabel">Toko</span>${storeField}</div>
        ${this.fieldsOf(d.type).map(f => this.fieldHTML(f, d)).join('')}
      </div>
      ${this.formError ? `<div class="form-error" role="alert">${esc(this.formError)}</div>` : ''}
      <div class="form-foot"><button type="submit" class="btn-big" id="fSave">${edit ? 'Simpan perubahan' : 'Simpan kegiatan'}</button></div>`;
  },
  submitName() {
    const v = ($('#fName').value || '').trim();
    if (!v) { this.formError = 'Isi nama kamu dulu.'; this.renderForm(false); $('#fName').focus(); return; }
    this.setUserName(v);
    this.draft.name = this.userName;
    this.draft.step = 'form';
    this.formError = '';
    this.renderForm(false);
    if (window.matchMedia('(pointer: fine)').matches) { const k1 = $('#f_k1'); if (k1) k1.focus({ preventScroll: true }); }
  },
  async saveForm() {
    this.keepDraft();
    const d = this.draft;
    if (!d) return;
    const err = (msg, focus) => {
      this.formError = msg;
      this.renderForm(false);
      const el = focus && document.getElementById(focus);
      if (el) el.focus();
    };
    ['store', 'date'].concat(SLOTS).forEach(k => { d[k] = String(d[k] || '').trim(); });
    d.name = String(d.name || this.userName || '').trim();
    if (!d.name) { d.step = 'name'; return err('Isi nama kamu dulu.', 'fName'); }
    if (!d.type) return err('Pilih jenis kegiatan.');
    if (!d.date) return err('Pilih tanggal kegiatan.', 'fDate');
    if (!d.store) return err('Pilih toko.', 'fStore');
    for (const f of this.fieldsOf(d.type)) {
      if (f.required && !d[f.slot]) return err(f.label + ' wajib diisi.', 'f_' + f.slot);
    }
    if (d.picPhone && !PHONE_RE.test(d.picPhone)) return err('Nomor PIC tidak valid.', 'f_picPhone');
    if (this.offline()) return err('Tidak ada koneksi internet. Coba lagi saat online.');
    const edit = !!d.editId;
    const row = { date: d.date, name: d.name, store: d.store, type: d.type, status: d.status || 'Terjadwal' };
    const slots = new Set(this.fieldsOf(d.type).map(f => f.slot));
    SLOTS.forEach(k => { row[k] = slots.has(k) ? d[k] : ''; });
    if (edit) row.id = d.editId;
    const btn = $('#fSave');
    btn.disabled = true;
    btn.textContent = 'Menyimpan...';
    try {
      const saved = edit ? await Sheets.updateActivity(row) : await Sheets.addActivity(row);
      const rec = this.replaceAct(saved, { ...row, id: row.id || ('tmp-' + Date.now()) });
      this.rememberContact(row.picName, row.picPhone, row.store);
      if (!edit) { this.lastStore = d.store; this.write('jw_store', d.store); }
      this.sel = rec.date;
      this.setMonthOf(rec.date);
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
    if (id === 'fStore' && this.draft) { this.keepDraft(); this.draft.store = v; this.formError = ''; this.renderForm(false); $('#fStore').focus(); return; }
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
    const names = Array.from(new Set(this.acts.filter(a => this.storeAllowed(a.store)).map(a => a.name).filter(Boolean))).sort((a, b) => a.localeCompare(b));
    const all = [{ v: '', l: 'Semua' }];
    const chips = (key, list) => `<div class="chips">${[['', 'Semua']].concat(list.map(x => [x, x])).map(([v, l]) =>
      `<button type="button" class="chipbtn" data-f="${key}" data-v="${esc(v)}" aria-pressed="${d[key] === v}">${esc(l)}</button>`).join('')}</div>`;
    return `
      <section class="card" style="display:flex;flex-direction:column;gap:16px">
        ${regs.length > 1 ? `<div class="field"><span class="label">Regional</span>${chips('regional', regs)}</div>` : ''}
        ${areas.length ? `<div class="field"><span class="label">Area</span>${this.ddHTML('flArea', all.concat(areas.map(a => ({ v: a, l: a }))), d.area, 'Semua')}</div>` : ''}
        <div class="field"><span class="label">Toko</span>${this.ddHTML('flStore', all.concat(stores.map(s => ({ v: s, l: this.short(s) }))), d.store, 'Semua', 'pin')}</div>
        <div class="field"><span class="label">Jenis kegiatan</span>${chips('type', CONFIG.ACTIVITY_TYPES.map(t => t.key))}</div>
        <div class="field"><span class="label">Dicatat oleh</span>${this.ddHTML('flPic', all.concat(names.map(p => ({ v: p, l: p }))), d.pic, 'Semua', 'user')}</div>
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
    let install = '';
    if (!this.installed) {
      const body = this.installEvt
        ? `<div class="install-text"><b>Pasang di layar utama</b><small>Buka seperti aplikasi biasa, bisa tanpa internet.</small></div><button class="btn-pill" data-act="install">Install</button>`
        : `<div class="install-text"><b>Pasang di layar utama</b><small>${ios ? 'Di Safari: tombol Bagikan → “Tambah ke Layar Utama”.' : 'Buka menu browser → “Install aplikasi” atau “Tambahkan ke layar utama”.'}</small></div>`;
      install = `<section class="card install"><span class="blob">${ic('download')}</span>${body}</section>`;
    }
    const vis = this.acts.filter(a => this.storeAllowed(a.store)).length;
    return `
      <section class="card profile">
        <div class="avatar">${esc((this.userName || '?').trim().charAt(0).toUpperCase() || '?')}</div>
        <div class="p-body"><div class="p-name">${esc(this.userName || 'Nama belum diisi')}</div></div>
        <button class="round" data-act="edit-name" aria-label="Ubah nama">${ic('pencil')}</button>
        ${this.editingName ? `<form class="name-edit" data-form="name"><input class="input" id="sName" maxlength="${CONFIG.LIMITS.name}" autocomplete="name" value="${esc(this.userName)}" aria-label="Nama kamu"><button type="submit" class="btn-plain">Simpan</button></form>` : ''}
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
          <div class="srow"><span>Kontak PIC</span><b>${this.contacts.length}</b></div>
          <button class="btn-soft" data-act="reload">${ic('refresh')}Muat ulang data</button>
        </section>
      </div>
      ${install}
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
      const d = b.dataset.d;
      this.sel = d;
      if (this.calMode === 'minggu') this.setMonthOf(d);
      this.renderCal();
      this.openDay(d);
    });
    $('#calPrev').addEventListener('click', () => this.shiftCal(-1));
    $('#calNext').addEventListener('click', () => this.shiftCal(1));
    $('#calMode').addEventListener('click', (e) => {
      const b = e.target.closest('[data-mode]');
      if (b) this.setCalMode(b.dataset.mode);
    });
    $('#calToday').addEventListener('click', () => {
      const t = this.today();
      this.sel = t;
      this.setMonthOf(t);
      this.renderCal();
    });
    $('#btnList').addEventListener('click', () => this.openList());
    $('#listView').addEventListener('click', (e) => {
      const open = e.target.closest('[data-open]');
      if (open) { this.openDetail(open.dataset.open); return; }
      const act = e.target.closest('[data-act]');
      if (!act) return;
      if (act.dataset.act === 'list-close') { this.closeList(); return; }
      if (act.dataset.act === 'list-prev' || act.dataset.act === 'list-next') {
        const x = new Date(this.listY, this.listM + (act.dataset.act === 'list-next' ? 1 : -1), 1);
        this.listY = x.getFullYear();
        this.listM = x.getMonth();
        this.renderList();
        const btn = $('#listView [data-act="' + act.dataset.act + '"]');
        if (btn) btn.focus({ preventScroll: true });
      }
    });

    $('#side').addEventListener('click', (e) => {
      const qa = e.target.closest('[data-qa]');
      if (qa) { this.quickAction(qa); return; }
      const open = e.target.closest('[data-open]');
      if (open) { this.openDetail(open.dataset.open); return; }
      const act = e.target.closest('[data-act]');
      if (act && act.dataset.act === 'nu-all') { this.nuAll = true; this.renderSide(); }
    });

    $('#btnAdd').addEventListener('click', () => this.openForm(null));
    $('#fab').addEventListener('click', () => this.openForm(null));
    $('#btnFilter').addEventListener('click', () => this.openFilter());
    $('#btnSettings').addEventListener('click', () => this.openSettings());
    $('#btnSearch').addEventListener('click', () => { if (this.searchOpen) this.closeSearch(); else this.openSearch(); });
    $('#qClose').addEventListener('click', () => this.closeSearch());
    $('#q').addEventListener('input', () => this.renderSearch());
    $('#searchResults').addEventListener('click', (e) => {
      const open = e.target.closest('[data-open]');
      if (!open) return;
      this.closeSearch();
      this.openDetail(open.dataset.open);
    });

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
      if (a === 'edit') { const x = this.acts.find(z => z.id === this.detailId); if (x) this.openForm(x); }
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
      this.setUserName(v);
      this.editingName = false;
      this.renderDrawer();
      this.toast('Nama disimpan');
    });

    $('#dialogBody').addEventListener('click', (e) => {
      if (this.dialogKind === 'day') {
        const open = e.target.closest('[data-open]');
        if (open) { this.openDetail(open.dataset.open); return; }
        if (e.target.closest('[data-act="day-list"]')) { this.openList(this.dayDate); return; }
        if (e.target.closest('[data-act="day-add"]')) { this.navPush(); this.openForm(null, this.dayDate); }
        return;
      }
      const dd = e.target.closest('.dd-btn');
      if (dd) { e.stopPropagation(); const w = dd.closest('.dropdown'); if (w.classList.contains('open')) this.ddClose(); else this.ddOpen(w); return; }
      const opt = e.target.closest('.dd-opt');
      if (opt) { this.ddPick(opt.closest('.dropdown'), opt.dataset.v); return; }
      const d = this.draft;
      if (!d || d.step !== 'form') return;
      const tile = e.target.closest('[data-type]');
      if (tile) {
        if (tile.dataset.type === d.type) return;
        this.keepDraft();
        d.type = tile.dataset.type;
        this.formError = '';
        this.renderForm(true);
        return;
      }
      const step = e.target.closest('[data-step]');
      if (step) {
        const inp = $('#f_k2');
        const v = Math.max(0, Math.min(99999, (parseInt(inp.value, 10) || 0) + Number(step.dataset.step)));
        inp.value = v;
        d.k2 = String(v);
      }
    });
    $('#dialogBody').addEventListener('input', (e) => {
      if (this.dialogKind !== 'form') return;
      if (this.formError) {
        this.formError = '';
        const box = $('#dialogBody .form-error');
        if (box) box.remove();
      }
    });
    $('#dialog').addEventListener('submit', (e) => {
      e.preventDefault();
      if (this.dialogKind !== 'form' || !this.draft) return;
      if (this.draft.step === 'name') this.submitName(); else this.saveForm();
    });

    document.addEventListener('click', (e) => {
      if (!e.target.closest('.dropdown')) this.ddClose();
      if (this.searchOpen && !e.target.closest('#searchPop') && !e.target.closest('#btnSearch')) this.closeSearch();
      const th = e.target.closest('[data-theme-set]');
      if (th) { this.setTheme(th.dataset.themeSet); return; }
      const pa = e.target.closest('[data-pal]');
      if (pa) this.setPalette(pa.dataset.pal);
    });
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      if (document.querySelector('.dropdown.open')) { this.ddClose(); return; }
      if (this.searchOpen) { this.closeSearch(); $('#btnSearch').focus(); return; }
      if (this.overlay) { this.closeOverlay(); return; }
      if (this.view === 'list') this.closeList();
    });
    window.addEventListener('popstate', () => {
      if (this.skipPop) { this.skipPop = false; return; }
      if (this.overlay) { this.closeOverlay(true); return; }
      if (this.view === 'list') this.closeList(true);
    });
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => this.applyTheme());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) return;
      this.render();
      if (!this.overlay && this.lastSync && Date.now() - this.lastSync > 5 * 60 * 1000) this.load(true);
    });

    this.installed = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    window.matchMedia('(display-mode: standalone)').addEventListener('change', (e) => {
      this.installed = e.matches;
      if (this.drawerKind === 'settings') this.renderDrawer();
    });
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
    try {
      const choice = await e.userChoice;
      if (choice && choice.outcome === 'accepted') this.installed = true;
    } catch {}
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
    clearTimeout(this.toastTimer);
    clearTimeout(t._hideT);
    t.classList.remove('out');
    t.hidden = true;
    void t.offsetWidth;
    t.textContent = msg;
    t.hidden = false;
    this.toastTimer = setTimeout(() => this.hideEl(t), 3200);
  }
};

document.addEventListener('DOMContentLoaded', () => App.init());

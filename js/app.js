

const App = {
  activities: [], stores: [],
  storeMeta: {}, _storeIndex: {},
  accessRegionals: [],
  filter: { regional: '', area: '', store: '', type: '', name: '' },
  viewYear: null, viewMonth: null,
  listTab: 'all',
  lastSync: null, connected: false,

  palette: 'krem_biru',
  fontFamily: 'default',
  lang: 'id',
  currentPage: 'calendar',

  async init() {
    this._loadSettings();
    this._applyPalette();
    this._applyFont();
    this._applyI18nStatic();

    const now = new Date();
    this.viewYear = now.getFullYear();
    this.viewMonth = now.getMonth();

    [
      ['sidebar',  () => this._bindSidebar()],
      ['topbar',   () => this._bindTopbar()],
      ['filter',   () => this._bindFilterModal()],
      ['activity', () => this._bindActivity()],
      ['settings', () => this._bindSettingsPage()],
      ['modals',   () => this._bindModals()],
      ['install',  () => this._bindInstall()]
    ].forEach(([name, fn]) => this._safe('bind:' + name, fn));

    const params = new URLSearchParams(location.search);
    const startPage = params.get('page');
    this._goToPage(['calendar', 'list', 'settings'].indexOf(startPage) >= 0 ? startPage : 'calendar');

    const cachedAct = Sheets.loadList(Sheets.CACHE_KEY_ACTIVITY);
    const cachedStore = Sheets.loadList(Sheets.CACHE_KEY_STORE);
    if (cachedAct) {
      this.stores = cachedStore ? cachedStore.data : [];
      this.activities = cachedAct.data;
      this.lastSync = cachedAct.ts;
      this._buildStoreMeta();
      this._renderAll();
      this._splashHide();
      this._toast(this.t('toast_cache_loading'));
      this.loadAll(true);
    } else {
      await this.loadAll();
    }

    if (params.get('add') === '1') this._openForm(null);
  },

  _loadSettings() {
    this.palette = this._read('palette') || 'krem_biru';
    if (!CONFIG.PALETTES[this.palette]) this.palette = 'krem_biru';
    this.fontFamily = this._read('fontFamily') || 'default';
    if (!CONFIG.FONT_OPTIONS[this.fontFamily]) this.fontFamily = 'default';
    this.lang = this._read('lang') || 'id';
    if (!CONFIG.I18N[this.lang]) this.lang = 'id';
    this.listTab = this._read('listTab') || 'all';
    if (['all', 'upcoming', 'past'].indexOf(this.listTab) < 0) this.listTab = 'all';
    try {
      const arr = JSON.parse(this._read('accessRegionals') || '[]');
      this.accessRegionals = Array.isArray(arr) ? arr.filter(Boolean) : [];
    } catch { this.accessRegionals = []; }
    const savedNav = this._read('navOpen');
    this.navOpen = savedNav === null ? window.innerWidth >= 900 : savedNav === '1';
  },
  _read(k) { try { return localStorage.getItem(k); } catch { return null; } },
  _save(k, v) { try { localStorage.setItem(k, v); } catch {} },

  t(key, params) {
    const dict = CONFIG.I18N[this.lang] || CONFIG.I18N.id;
    let val = dict[key];
    if (val == null) val = CONFIG.I18N.id[key];
    if (val == null) return key;
    if (Array.isArray(val)) return val;
    if (params) {
      Object.keys(params).forEach(k => {
        val = String(val).replace(new RegExp('\\{' + k + '\\}', 'g'), params[k]);
      });
    }
    return val;
  },
  _applyI18nStatic() {
    document.documentElement.lang = this.lang;
    document.querySelectorAll('[data-i18n]').forEach(el => {
      el.textContent = this.t(el.dataset.i18n);
    });
    document.querySelectorAll('.sidebar-item').forEach(btn => {
      const label = btn.querySelector('span');
      if (label) { btn.title = label.textContent; btn.setAttribute('aria-label', label.textContent); }
    });
    this._setText('stVersion', CONFIG.APP_VERSION);
  },

  _applyPalette() {
    const p = CONFIG.PALETTES[this.palette] || CONFIG.PALETTES.krem_biru;
    const root = document.documentElement;
    Object.entries(p.vars).forEach(([k, v]) => root.style.setProperty(k, v));
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = p.themeColor;
  },
  _applyFont() {
    const font = CONFIG.FONT_OPTIONS[this.fontFamily] || CONFIG.FONT_OPTIONS.default;
    document.documentElement.style.setProperty('--font-sans', font.stack);
  },

  _bindSidebar() {
    const sb = document.getElementById('sidebar');
    const bd = document.getElementById('sidebarBackdrop');
    const isNarrow = () => window.innerWidth < 900;
    const setNav = (open) => {
      this.navOpen = open;
      sb.classList.toggle('open', open);
      bd.classList.toggle('open', open);
      document.body.classList.toggle('nav-open', open);
      if (!isNarrow()) this._save('navOpen', open ? '1' : '0');
    };
    this._setNav = setNav;
    setNav(isNarrow() ? false : this.navOpen);
    this._on('btnMenu', 'click', () => setNav(!this.navOpen));
    bd.addEventListener('click', () => setNav(false));
    document.querySelectorAll('.sidebar-item[data-page]').forEach(btn => {
      btn.addEventListener('click', () => {
        this._goToPage(btn.dataset.page);
        if (isNarrow()) setNav(false);
      });
    });
    window.addEventListener('resize', () => {
      if (isNarrow() && this.navOpen) setNav(false);
    });
  },
  _goToPage(page) {
    this.currentPage = page;
    document.querySelectorAll('.sidebar-item[data-page]').forEach(b => b.classList.toggle('active', b.dataset.page === page));
    document.querySelectorAll('.page').forEach(p => p.classList.toggle('active', p.dataset.page === page));
    document.getElementById('pageTitle').textContent = this._pageTitle(page);
    document.getElementById('btnFilter').style.display = page === 'settings' ? 'none' : '';
    window.scrollTo({ top: 0, behavior: 'smooth' });
    this._renderPage();
  },
  _pageTitle(page) {
    return { calendar: this.t('nav_calendar'), list: this.t('nav_list'), settings: this.t('nav_settings') }[page] || '';
  },
  _bindTopbar() {
    this._on('btnFilter', 'click', () => this._openFilter());
  },

  _bindModals() {
    document.querySelectorAll('.modal [data-close-modal]').forEach(el => {
      el.addEventListener('click', () => { el.closest('.modal').hidden = true; });
    });
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      const open = Array.from(document.querySelectorAll('.modal')).filter(m => !m.hidden);
      if (open.length) open[open.length - 1].hidden = true;
    });
  },

  async loadAll(silent) {
    if (!silent) this._splash();
    try {
      const res = await Sheets.fetchAll();
      this.stores = Array.isArray(res.toko) ? res.toko : [];
      this.activities = Array.isArray(res.kegiatan) ? res.kegiatan : [];
      this.lastSync = Date.now();
      this.connected = true;
      this._buildStoreMeta();
      Sheets.saveList(Sheets.CACHE_KEY_ACTIVITY, this.activities);
      Sheets.saveList(Sheets.CACHE_KEY_STORE, this.stores);
      this._renderAll();
      this._splashHide();
    } catch (e) {
      this.connected = false;
      if (!silent) this._splash(this.t('splash_failed', { msg: e.message }), true);
      else this._toast(this.t('toast_load_failed', { msg: e.message }));
      this._safe('settings', () => this._renderSettings());
    }
  },

  _buildStoreMeta() {
    this.storeMeta = {};
    this._storeIndex = {};
    this.stores.forEach(s => {
      this.storeMeta[s.store] = { regional: s.regional || '', area: s.area || '' };
      const n = this._storeNorm(s.store);
      if (n && this._storeIndex[n] === undefined) this._storeIndex[n] = s.store;
    });
    const known = this.accessRegionals.filter(r => this._allRegionals().indexOf(r) >= 0);
    if (this.stores.length && known.length !== this.accessRegionals.length) {
      this.accessRegionals = known;
      this._save('accessRegionals', JSON.stringify(known));
    }
    this.activities = this.activities.map(a => this._normRecord(a));
  },
  _normRecord(a) {
    const status = this._statusKey(a.status);
    return {
      id: String(a.id || ''),
      date: String(a.date || ''),
      name: String(a.name || '').trim(),
      store: this._canonStore(a.store),
      type: String(a.type || '').trim(),
      k1: String(a.k1 == null ? '' : a.k1).trim(),
      k2: String(a.k2 == null ? '' : a.k2).trim(),
      status: status,
      updatedAt: String(a.updatedAt || '')
    };
  },
  _statusKey(v) {
    const s = String(v == null ? '' : v).trim();
    if (!s) return 'Terjadwal';
    const hit = CONFIG.STATUSES.find(x => x.key.toLowerCase() === s.toLowerCase());
    return hit ? hit.key : s;
  },
  _storeNorm(s) {
    return String(s == null ? '' : s)
      .toLowerCase()
      .replace(/^labbaik\s*chicken/, '')
      .replace(/^lc\b/, '')
      .replace(/[^a-z0-9]/g, '');
  },
  _canonStore(name) {
    const raw = String(name == null ? '' : name).trim();
    if (!raw) return '';
    return this._storeIndex[this._storeNorm(raw)] || raw;
  },

  _allRegionals() {
    return Array.from(new Set(this.stores.map(s => s.regional).filter(Boolean))).sort();
  },
  _allowedRegionals() {
    const all = this._allRegionals();
    if (!this.accessRegionals.length) return all;
    const hit = all.filter(r => this.accessRegionals.indexOf(r) >= 0);
    return hit.length ? hit : all;
  },
  _storeAllowed(store) {
    if (!this.accessRegionals.length) return true;
    const m = this.storeMeta[store];
    return !!m && this._allowedRegionals().indexOf(m.regional) >= 0;
  },
  _storeInScope(store, regional, area) {
    if (!regional && !area) return true;
    const m = this.storeMeta[store];
    if (!m) return false;
    if (regional && m.regional !== regional) return false;
    if (area && m.area !== area) return false;
    return true;
  },
  _storeList() {
    let list = this.stores.map(s => s.store).filter(s => this._storeAllowed(s));
    if (!list.length) list = Array.from(new Set(this.activities.map(a => a.store).filter(Boolean)));
    return list.sort((a, b) => this._short(a).localeCompare(this._short(b)));
  },

  _activityType(key) { return CONFIG.ACTIVITY_TYPES.find(t => t.key === key) || null; },
  _typeColor(key) { const t = this._activityType(key); return t ? t.color : 'var(--ink-3)'; },

  _monthKey(y, m) { return y + '-' + String(m + 1).padStart(2, '0'); },
  _today() { return this._toDateStr(new Date()); },
  _matchesFilter(a) {
    const f = this.filter;
    if (!this._storeAllowed(a.store)) return false;
    if (f.store && a.store !== f.store) return false;
    if ((f.regional || f.area) && !this._storeInScope(a.store, f.regional, f.area)) return false;
    if (f.type && a.type !== f.type) return false;
    if (f.name && a.name !== f.name) return false;
    return true;
  },
  _monthActivities() {
    const key = this._monthKey(this.viewYear, this.viewMonth);
    return this.activities.filter(a => a.date && a.date.slice(0, 7) === key && this._matchesFilter(a));
  },
  _activeFilterCount() {
    return ['regional', 'area', 'store', 'type', 'name'].filter(k => this.filter[k]).length;
  },
  _state(a, today) {
    if (a.status === 'Batal') return 'cancelled';
    if (a.status === 'Selesai') return 'done';
    return a.date >= today ? 'scheduled' : 'unconfirmed';
  },
  _stateLabel(state, a) {
    if (state === 'unconfirmed') return this.t('st_unconfirmed');
    const st = CONFIG.STATUSES.find(s => s.key === a.status);
    return st ? this._loc(st.label) : a.status;
  },
  _setMonth(y, m) {
    const d = new Date(y, m, 1);
    this.viewYear = d.getFullYear();
    this.viewMonth = d.getMonth();
    this._renderAll();
  },

  _safe(name, fn) {
    try { fn(); } catch (e) { console.error('Render ' + name + ' gagal:', e); }
  },
  _renderAll() {
    this._updatePeriodLabel();
    this._renderPage();
    this._safe('settings', () => this._renderSettings());
    const day = document.getElementById('actDayModal');
    if (!day.hidden && this._dayOpen) this._safe('day', () => this._renderDay(this._dayOpen));
  },
  _renderPage() {
    if (this.currentPage === 'calendar') this._safe('calendar', () => this._renderCalendar());
    if (this.currentPage === 'list')     this._safe('list', () => this._renderList());
    if (this.currentPage === 'settings') this._safe('settings', () => this._renderSettings());
  },
  _updatePeriodLabel() {
    this._setText('periodLabel', this.t('months_short')[this.viewMonth] + ' ' + this.viewYear);
    const n = this._activeFilterCount();
    const badge = document.getElementById('filterCount');
    badge.hidden = n === 0;
    badge.textContent = n;
  },

  _monthNavHtml(prefix) {
    return `<div class="cal-nav">
      <button class="cal-nav-btn" id="${prefix}Prev" aria-label="‹">‹</button>
      <div class="cal-title">${this._esc(this.t('months_full')[this.viewMonth])} ${this.viewYear}</div>
      <button class="cal-nav-btn" id="${prefix}Next" aria-label="›">›</button>
    </div>`;
  },
  _bindMonthNav(prefix) {
    document.getElementById(prefix + 'Prev').onclick = () => this._setMonth(this.viewYear, this.viewMonth - 1);
    document.getElementById(prefix + 'Next').onclick = () => this._setMonth(this.viewYear, this.viewMonth + 1);
  },

  _bindActivity() {
    document.querySelectorAll('[data-act-add]').forEach(b => b.addEventListener('click', () => this._openForm(null)));
    this._on('actFormSave', 'click', () => this._saveForm());
    this._on('btnActReload', 'click', () => this.loadAll(true));
    this._on('actDayAdd', 'click', () => this._openForm(null, this._dayOpen));
    this._on('actFName', 'input', () => this._formErr(''));
    this._on('actFDate', 'input', () => this._formErr(''));
    const openRow = (e) => {
      const row = e.target.closest('.act-row[data-id]');
      if (!row) return;
      const a = this.activities.find(x => x.id === row.dataset.id);
      if (a) this._openForm(a);
    };
    ['actList', 'actDayBody'].forEach(id => {
      this._on(id, 'click', openRow);
      this._on(id, 'keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openRow(e); } });
    });
  },

  _renderCalendar() {
    const host = document.getElementById('actCalendar');
    const y = this.viewYear, m = this.viewMonth;
    const today = this._today();
    const rows = this._monthActivities();
    const byDate = {};
    rows.forEach(a => { (byDate[a.date] = byDate[a.date] || []).push(a); });
    this._setText('calCount', this.t('act_count', { n: rows.length }));

    const dowNames = this.t('days_short');
    const startOffset = (new Date(y, m, 1).getDay() + 6) % 7;
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    let html = this._monthNavHtml('cal') +
      `<div class="acal"><div class="acal-head">${dowNames.map(n => `<div>${n}</div>`).join('')}</div><div class="acal-grid">`;
    for (let i = 0; i < startOffset; i++) html += '<div class="acal-cell empty"></div>';
    for (let d = 1; d <= daysInMonth; d++) {
      const ds = this._monthKey(y, m) + '-' + String(d).padStart(2, '0');
      const items = byDate[ds] || [];
      const live = items.filter(a => a.status !== 'Batal');
      const counts = {};
      (live.length ? live : items).forEach(a => { counts[a.type] = (counts[a.type] || 0) + 1; });
      const order = CONFIG.ACTIVITY_TYPES.map(t => t.key).concat(Object.keys(counts).filter(k => !this._activityType(k)).sort());
      const tags = order.filter(k => counts[k]).map(k =>
        `<span class="acal-tag" style="background:${this._typeColor(k)}">${this._esc(k)}${counts[k] > 1 ? '<b>' + counts[k] + '</b>' : ''}</span>`
      ).join('');
      let cls = 'acal-cell';
      if (items.length) cls += ' has';
      if (items.length && !live.length) cls += ' only-cancelled';
      if (ds === today) cls += ' today';
      else if (ds < today) cls += ' past';
      html += `<button type="button" class="${cls}" data-d="${ds}">
        <span class="acal-day">${d}</span>
        <span class="acal-tags">${tags}</span>
      </button>`;
    }
    html += '</div></div>';
    host.innerHTML = html;
    this._bindMonthNav('cal');
    host.querySelectorAll('.acal-cell[data-d]').forEach(cell => {
      cell.onclick = () => this._openDay(cell.dataset.d);
    });

    document.getElementById('actCalLegend').innerHTML = CONFIG.ACTIVITY_TYPES
      .map(t => `<span class="acal-legend-item"><span class="acal-dot" style="background:${t.color}"></span>${this._esc(this._loc(t.label))}</span>`)
      .concat([`<span class="acal-legend-item"><span class="acal-dot acal-dot-today"></span>${this._esc(this.t('today'))}</span>`])
      .join('');
  },

  _openDay(ds) {
    this._dayOpen = ds;
    this._renderDay(ds);
    document.getElementById('actDayModal').hidden = false;
  },
  _renderDay(ds) {
    const today = this._today();
    const items = this.activities.filter(a => a.date === ds && this._matchesFilter(a))
      .sort((a, b) => this._typeOrder(a.type) - this._typeOrder(b.type) || a.name.localeCompare(b.name));
    this._setText('actDayTitle', this.t('act_day_title', { date: this._formatFull(ds) }));
    this._setText('actDaySub', items.length ? this.t('act_count', { n: items.length }) + ' · ' + this.t('act_tap_edit') : '');
    document.getElementById('actDayBody').innerHTML = items.length
      ? items.map(a => this._rowHtml(a, today, false)).join('')
      : `<div class="empty-note">${this._esc(this.t('act_day_none'))}</div>`;
  },
  _typeOrder(key) {
    const i = CONFIG.ACTIVITY_TYPES.findIndex(t => t.key === key);
    return i < 0 ? 99 : i;
  },

  _renderList() {
    const today = this._today();
    const rows = this._monthActivities();
    const upcoming = rows.filter(a => a.date >= today)
      .sort((a, b) => a.date.localeCompare(b.date) || this._typeOrder(a.type) - this._typeOrder(b.type) || a.name.localeCompare(b.name));
    const past = rows.filter(a => a.date < today)
      .sort((a, b) => b.date.localeCompare(a.date) || this._typeOrder(a.type) - this._typeOrder(b.type) || a.name.localeCompare(b.name));

    document.getElementById('listNav').innerHTML = this._monthNavHtml('list');
    this._bindMonthNav('list');

    const count = (list, st) => list.filter(a => this._state(a, today) === st).length;
    const todayCount = upcoming.filter(a => a.date === today).length;
    const unconfirmed = count(past, 'unconfirmed');
    const cards = [
      { key: 'all',      label: this.t('sum_all'),      n: rows.length,     sub: this.t('sum_done', { n: count(rows, 'done') }) },
      { key: 'upcoming', label: this.t('grp_upcoming'), n: upcoming.length, sub: this.t('sum_today', { n: todayCount }) },
      { key: 'past',     label: this.t('grp_past'),     n: past.length,     sub: this.t('sum_unconfirmed', { n: unconfirmed }), warn: unconfirmed > 0 }
    ];
    const sum = document.getElementById('listSummary');
    sum.innerHTML = cards.map(c => `<button type="button" class="sum-card${c.key === this.listTab ? ' active' : ''}" data-tab="${c.key}">
        <span class="sum-value">${c.n}</span>
        <span class="sum-label">${this._esc(c.label)}</span>
        <span class="sum-sub${c.warn ? ' warn' : ''}">${this._esc(c.sub)}</span>
      </button>`).join('');
    sum.querySelectorAll('.sum-card').forEach(b => {
      b.onclick = () => { this.listTab = b.dataset.tab; this._save('listTab', this.listTab); this._renderList(); };
    });

    const sections = [];
    if (this.listTab !== 'past')     sections.push({ label: this.t('grp_upcoming'), list: upcoming });
    if (this.listTab !== 'upcoming') sections.push({ label: this.t('grp_past'),     list: past });
    const shown = sections.reduce((n, s) => n + s.list.length, 0);
    this._setText('actCount', this.t('act_count', { n: shown }));

    const el = document.getElementById('actList');
    if (!shown) {
      const msg = this._activeFilterCount() ? this.t('act_none_filter') : this.t('act_none');
      el.innerHTML = `<div class="empty-note">${this._esc(msg)}</div>`;
      return;
    }
    el.innerHTML = sections.filter(s => s.list.length).map(s =>
      `<div class="list-section"><span>${this._esc(s.label)}</span><span>${s.list.length}</span></div>` +
      s.list.map(a => this._rowHtml(a, today, true)).join('')
    ).join('');
  },

  _rowHtml(a, today, withDate) {
    const state = this._state(a, today);
    const detail = this._activityDetailText(a);
    const dateHtml = withDate ? `<span class="act-date${a.date === today ? ' is-today' : ''}">${this._esc(this._formatDay(a.date, today))}</span>` : '';
    return `<div class="act-row act-row-click${state === 'cancelled' ? ' is-cancelled' : ''}" data-id="${this._esc(a.id)}" role="button" tabindex="0">
      <div class="act-row-body">
        <div class="act-row-main">
          ${dateHtml}
          <span class="act-tag" style="background:${this._typeColor(a.type)}">${this._esc(a.type)}</span>
          <span class="act-name">${this._esc(a.name)}</span>
          <span class="act-store">${this._esc(this._short(a.store))}</span>
        </div>
        ${detail ? `<div class="act-row-detail">${this._esc(detail)}</div>` : ''}
      </div>
      <span class="act-status st-${state}">${this._esc(this._stateLabel(state, a))}</span>
    </div>`;
  },
  _activityDetailText(a) {
    const type = this._activityType(a.type);
    if (!type) return [a.k1, a.k2].filter(Boolean).join(' · ');
    return type.fields
      .map(fl => ({ label: this._loc(fl.label), val: fl.slot === 'k1' ? a.k1 : a.k2 }))
      .filter(x => x.val !== '' && x.val != null)
      .map(x => x.label + ': ' + x.val)
      .join(' · ');
  },

  _openForm(existing, presetDate) {
    const edit = !!(existing && existing.id);
    const today = this._today();
    const viewingKey = this._monthKey(this.viewYear, this.viewMonth);
    const defaultDate = presetDate || (today.slice(0, 7) === viewingKey ? today : viewingKey + '-01');
    this._draft = edit
      ? { ...existing }
      : { id: '', name: this._read('lastName') || '', date: defaultDate,
          store: this.filter.store || '', type: this.filter.type || '', k1: '', k2: '', status: 'Terjadwal' };
    const d = this._draft;

    this._setText('actFormTitle', this.t(edit ? 'act_form_edit' : 'act_form_add'));
    const meta = document.getElementById('actFormMeta');
    meta.hidden = !(edit && d.updatedAt);
    meta.textContent = edit && d.updatedAt ? this.t('act_updated_at', { t: this._formatStamp(d.updatedAt) }) : '';

    document.getElementById('actFName').value = d.name;
    document.getElementById('actFName').maxLength = CONFIG.LIMITS.name;
    document.getElementById('actFDate').value = d.date;
    document.getElementById('actNameList').innerHTML = Array.from(new Set(this.activities.map(a => a.name).filter(Boolean)))
      .sort((a, b) => a.localeCompare(b)).map(n => `<option value="${this._esc(n)}"></option>`).join('');
    this._formErr('');

    const storeOpts = {};
    this._storeList().forEach(s => { storeOpts[s] = this._short(s); });
    if (d.store && !storeOpts[d.store]) storeOpts[d.store] = this._short(d.store);
    this._initDropdown('actFormStore', storeOpts, d.store, (v) => { d.store = v; this._formErr(''); },
      { search: true, placeholder: this.t('act_pick_store') });

    const typeOpts = {};
    CONFIG.ACTIVITY_TYPES.forEach(t => { typeOpts[t.key] = this._loc(t.label); });
    if (d.type && !typeOpts[d.type]) typeOpts[d.type] = d.type;
    this._initDropdown('actFormType', typeOpts, d.type, (v) => {
      if (v !== d.type) { d.k1 = ''; d.k2 = ''; }
      d.type = v;
      this._formErr('');
      this._renderTypeFields();
    }, { placeholder: this.t('act_pick_type') });
    this._renderTypeFields();
    this._renderStatusSeg();

    const btn = document.getElementById('actFormSave');
    btn.disabled = false;
    btn.textContent = this.t('save');
    document.getElementById('actFormModal').hidden = false;
    if (!edit && !d.name) setTimeout(() => document.getElementById('actFName').focus(), 50);
  },

  _renderTypeFields() {
    const wrap = document.getElementById('actFormDynamic');
    const d = this._draft;
    const type = this._activityType(d.type);
    const fields = type ? type.fields : (d.type ? [
      { slot: 'k1', type: 'text', max: 140, optional: true, label: { id: 'Keterangan 1', en: 'Note 1' } },
      { slot: 'k2', type: 'text', max: 140, optional: true, label: { id: 'Keterangan 2', en: 'Note 2' } }
    ] : []);
    wrap.innerHTML = fields.map(fl => {
      const label = this._esc(this._loc(fl.label)) + (this._fieldOptional(fl) ? ` <span class="opt">(${this._esc(this.lang === 'en' ? 'optional' : 'opsional')})</span>` : '');
      const id = 'actDyn_' + fl.slot;
      if (fl.type === 'textarea') {
        return `<div class="form-row">
          <label for="${id}">${label}</label>
          <textarea id="${id}" class="form-input" rows="3" maxlength="${fl.max}" data-slot="${fl.slot}"></textarea>
          <div class="char-hint" id="${id}_hint"></div>
        </div>`;
      }
      const attrs = fl.type === 'number' ? `type="number" inputmode="numeric" min="0" step="1"` : `type="text" maxlength="${fl.max}"`;
      return `<div class="form-row">
        <label for="${id}">${label}</label>
        <input id="${id}" class="form-input" ${attrs} data-slot="${fl.slot}" autocomplete="off" />
      </div>`;
    }).join('');

    wrap.querySelectorAll('[data-slot]').forEach(inp => {
      const slot = inp.dataset.slot;
      const hint = document.getElementById(inp.id + '_hint');
      const syncHint = () => { if (hint) hint.textContent = this.t('chars_left', { n: Math.max(0, inp.maxLength - inp.value.length) }); };
      inp.value = d[slot] || '';
      syncHint();
      inp.addEventListener('input', () => {
        d[slot] = inp.value;
        this._formErr('');
        syncHint();
      });
    });
  },
  _fieldOptional(fl) { return !!fl.optional || fl.type === 'number'; },

  _renderStatusSeg() {
    const wrap = document.getElementById('actFormStatus');
    const d = this._draft;
    const opts = CONFIG.STATUSES.slice();
    if (d.status && !opts.find(s => s.key === d.status)) opts.push({ key: d.status, label: d.status });
    wrap.innerHTML = opts.map(s =>
      `<button type="button" class="seg-btn st-btn-${this._esc(s.key.toLowerCase())}${s.key === d.status ? ' active' : ''}" data-v="${this._esc(s.key)}">${this._esc(this._loc(s.label))}</button>`
    ).join('');
    wrap.querySelectorAll('.seg-btn').forEach(b => {
      b.onclick = () => {
        d.status = b.dataset.v;
        wrap.querySelectorAll('.seg-btn').forEach(x => x.classList.toggle('active', x === b));
      };
    });
  },

  async _saveForm() {
    const d = this._draft;
    d.name = document.getElementById('actFName').value.trim();
    d.date = document.getElementById('actFDate').value;
    if (!d.name)  return this._formErr(this.t('act_err_name'));
    if (!d.date)  return this._formErr(this.t('act_err_date'));
    if (!d.store) return this._formErr(this.t('act_err_store'));
    if (!d.type)  return this._formErr(this.t('act_err_type'));
    const type = this._activityType(d.type);
    if (type) {
      for (const fl of type.fields) {
        if (this._fieldOptional(fl)) continue;
        if (!String(d[fl.slot] == null ? '' : d[fl.slot]).trim()) {
          return this._formErr(this.t('act_err_field', { f: this._loc(fl.label) }));
        }
      }
    }
    if (navigator.onLine === false) return this._formErr(this.t('act_offline'));

    this._formErr('');
    const edit = !!d.id;
    const btn = document.getElementById('actFormSave');
    btn.disabled = true;
    btn.textContent = this.t('saving');
    const row = {
      date: d.date, name: d.name, store: d.store, type: d.type,
      k1: String(d.k1 || '').trim(), k2: String(d.k2 || '').trim(), status: d.status || 'Terjadwal'
    };
    if (edit) row.id = d.id;
    try {
      const saved = edit ? await Sheets.updateActivity(row) : await Sheets.addActivity(row);
      const rec = this._normRecord(saved && saved.id ? saved : { ...row, id: row.id || ('tmp-' + Date.now()) });
      const idx = this.activities.findIndex(a => a.id === rec.id);
      if (idx >= 0) this.activities[idx] = rec; else this.activities.push(rec);
      Sheets.saveList(Sheets.CACHE_KEY_ACTIVITY, this.activities);
      this._save('lastName', rec.name);
      document.getElementById('actFormModal').hidden = true;
      this._toast(this.t(edit ? 'act_updated' : 'act_saved'));
      const [y, m] = rec.date.split('-').map(Number);
      if (y && m && (y !== this.viewYear || m - 1 !== this.viewMonth)) this._setMonth(y, m - 1);
      else this._renderAll();
    } catch (e) {
      this._formErr(this.t('act_save_failed') + ': ' + e.message);
      btn.disabled = false;
      btn.textContent = this.t('save');
    }
  },
  _formErr(msg) {
    const el = document.getElementById('actFormError');
    el.hidden = !msg;
    el.textContent = msg || '';
  },

  _bindFilterModal() {
    this._on('filterOk', 'click', () => this._applyFilter());
    this._on('filterCancelReset', 'click', () => this._filterCancelOrReset());
  },
  _openFilter() {
    this._fltDraft = { ...this.filter, year: this.viewYear, month: this.viewMonth, pickYear: this.viewYear };
    this._filterOrig = JSON.stringify(this._draftComparable());
    this._renderFilterBody();
    document.getElementById('filterModal').hidden = false;
  },
  _draftComparable() {
    const d = this._fltDraft;
    return { regional: d.regional, area: d.area, store: d.store, type: d.type, name: d.name, year: d.year, month: d.month };
  },
  _renderFilterBody() {
    const d = this._fltDraft;
    const months = this.t('months_short');
    const now = new Date();
    document.getElementById('filterMonth').innerHTML = `
      <div class="month-picker">
        <div class="cal-nav">
          <button class="cal-nav-btn" id="fYearPrev">‹</button>
          <div class="cal-title">${d.pickYear}</div>
          <button class="cal-nav-btn" id="fYearNext">›</button>
        </div>
        <div class="month-grid">${months.map((n, i) => {
          let cls = 'month-btn';
          if (d.pickYear === d.year && i === d.month) cls += ' active';
          if (d.pickYear === now.getFullYear() && i === now.getMonth()) cls += ' current';
          return `<button type="button" class="${cls}" data-m="${i}">${this._esc(n)}</button>`;
        }).join('')}</div>
        <button type="button" class="link-btn" id="fThisMonth">${this._esc(this.t('this_month'))}</button>
      </div>`;
    document.getElementById('fYearPrev').onclick = () => { d.pickYear--; this._renderFilterBody(); };
    document.getElementById('fYearNext').onclick = () => { d.pickYear++; this._renderFilterBody(); };
    document.getElementById('fThisMonth').onclick = () => {
      d.year = d.pickYear = now.getFullYear(); d.month = now.getMonth(); this._renderFilterBody();
    };
    document.querySelectorAll('#filterMonth .month-btn').forEach(b => {
      b.onclick = () => { d.year = d.pickYear; d.month = Number(b.dataset.m); this._renderFilterBody(); };
    });

    const wrap = document.getElementById('filterExtra');
    const row = (label, key) =>
      `<div class="filter-row"><label>${this._esc(label)}</label><div class="dropdown-select" data-key="${key}"></div></div>`;
    const regionals = this._allowedRegionals();
    const showRegional = regionals.length > 1;
    const areas = Array.from(new Set(this.stores
      .filter(s => this._storeAllowed(s.store))
      .filter(s => !d.regional || s.regional === d.regional)
      .map(s => s.area).filter(Boolean))).sort();
    const showArea = areas.length > 0;
    if (!showRegional) d.regional = '';
    wrap.innerHTML = (showRegional ? row(this.t('regional'), 'fltRegional') : '')
      + (showArea ? row(this.t('area'), 'fltArea') : '')
      + row(this.t('act_store'), 'fltStore')
      + row(this.t('act_type'), 'fltType')
      + row(this.t('act_name'), 'fltName');

    if (showRegional) {
      const opts = { '': this.t('all') };
      regionals.forEach(r => { opts[r] = r; });
      this._initDropdown('fltRegional', opts, d.regional, (v) => {
        d.regional = v;
        if (v && d.area && !this.stores.some(s => s.area === d.area && s.regional === v)) d.area = '';
        if (v && d.store && !this._storeInScope(d.store, v, d.area)) d.store = '';
        this._renderFilterBody();
      }, { search: regionals.length > 8 });
    }
    if (showArea) {
      const opts = { '': this.t('all') };
      areas.forEach(a => { opts[a] = a; });
      if (d.area && !opts[d.area]) opts[d.area] = d.area;
      this._initDropdown('fltArea', opts, d.area, (v) => {
        d.area = v;
        if (v && d.store && !this._storeInScope(d.store, d.regional, v)) d.store = '';
        this._renderFilterBody();
      }, { search: areas.length > 8 });
    }

    const storeOpts = { '': this.t('all') };
    this._storeList().filter(s => this._storeInScope(s, d.regional, d.area)).forEach(s => { storeOpts[s] = this._short(s); });
    if (!d.regional && !d.area) {
      Array.from(new Set(this.activities.map(a => a.store).filter(Boolean)))
        .filter(s => this._storeAllowed(s))
        .forEach(s => { if (!storeOpts[s]) storeOpts[s] = this._short(s); });
    }
    if (d.store && !storeOpts[d.store]) storeOpts[d.store] = this._short(d.store);
    this._initDropdown('fltStore', storeOpts, d.store, (v) => { d.store = v; this._updateCancelResetBtn(); }, { search: true });

    const typeOpts = { '': this.t('all') };
    CONFIG.ACTIVITY_TYPES.forEach(t => { typeOpts[t.key] = this._loc(t.label); });
    if (d.type && !typeOpts[d.type]) typeOpts[d.type] = d.type;
    this._initDropdown('fltType', typeOpts, d.type, (v) => { d.type = v; this._updateCancelResetBtn(); });

    const nameOpts = { '': this.t('all') };
    Array.from(new Set(this.activities.map(a => a.name).filter(Boolean)))
      .sort((a, b) => a.localeCompare(b))
      .forEach(n => { nameOpts[n] = n; });
    if (d.name && !nameOpts[d.name]) nameOpts[d.name] = d.name;
    this._initDropdown('fltName', nameOpts, d.name, (v) => { d.name = v; this._updateCancelResetBtn(); }, { search: true });

    this._updateCancelResetBtn();
  },
  _updateCancelResetBtn() {
    const btn = document.getElementById('filterCancelReset');
    const changed = JSON.stringify(this._draftComparable()) !== this._filterOrig;
    btn.textContent = changed ? this.t('reset') : this.t('cancel');
    btn.dataset.mode = changed ? 'reset' : 'cancel';
  },
  _filterCancelOrReset() {
    const btn = document.getElementById('filterCancelReset');
    if (btn.dataset.mode === 'reset') {
      const orig = JSON.parse(this._filterOrig);
      this._fltDraft = { ...orig, pickYear: orig.year };
      this._renderFilterBody();
    } else {
      document.getElementById('filterModal').hidden = true;
    }
  },
  _applyFilter() {
    const d = this._fltDraft;
    this.filter = { regional: d.regional, area: d.area, store: d.store, type: d.type, name: d.name };
    document.getElementById('filterModal').hidden = true;
    this._setMonth(d.year, d.month);
  },

  _bindSettingsPage() {
    this._on('btnClearCache', 'click', async () => {
      Sheets.clearCache();
      try {
        if ('caches' in window) { const keys = await caches.keys(); await Promise.all(keys.map(k => caches.delete(k))); }
        if ('serviceWorker' in navigator) { const r = await navigator.serviceWorker.getRegistrations(); await Promise.all(r.map(x => x.unregister())); }
      } catch {}
      this._toast(this.t('toast_cache_cleared'));
    });
    this._on('btnReload', 'click', () => this.loadAll());
    this._on('btnAccessApply', 'click', () => {
      this.accessRegionals = (this._accessDraft || []).slice();
      this._save('accessRegionals', JSON.stringify(this.accessRegionals));
      if (this.filter.regional && this._allowedRegionals().indexOf(this.filter.regional) < 0) this.filter.regional = '';
      if (this.filter.store && !this._storeAllowed(this.filter.store)) this.filter.store = '';
      this._renderAll();
      this._toast(this.t('setting_regional_saved'));
    });
    this._buildSettingDropdowns();
  },
  _buildSettingDropdowns() {
    const paletteOpts = {};
    Object.entries(CONFIG.PALETTES).forEach(([k, v]) => { paletteOpts[k] = this._loc(v.label); });
    this._initDropdown('palette', paletteOpts, this.palette, (v) => {
      this.palette = v; this._save('palette', v); this._applyPalette();
    });
    const langOpts = {};
    Object.entries(CONFIG.LANGUAGES).forEach(([k, v]) => { langOpts[k] = this._loc(v); });
    this._initDropdown('lang', langOpts, this.lang, (v) => {
      this.lang = v; this._save('lang', v);
      this._applyI18nStatic();
      this._buildSettingDropdowns();
      document.getElementById('pageTitle').textContent = this._pageTitle(this.currentPage);
      this._renderAll();
    });
    const fontOpts = {};
    Object.entries(CONFIG.FONT_OPTIONS).forEach(([k, v]) => { fontOpts[k] = { label: this._loc(v.label), stack: v.stack }; });
    this._initDropdown('font', fontOpts, this.fontFamily, (v) => {
      this.fontFamily = v; this._save('fontFamily', v); this._applyFont();
    });
  },
  _renderSettings() {
    const st = document.getElementById('stStatus');
    st.textContent = this.connected ? this.t('setting_connected') : this.t('setting_not_connected');
    st.style.color = this.connected ? 'var(--success)' : 'var(--ink-3)';
    const acts = this.activities.filter(a => this._storeAllowed(a.store)).length;
    this._setText('stActCount', acts.toLocaleString(this._locale()) + ' ' + this.t('acts_suffix'));
    this._setText('stStoreCount', this.stores.filter(s => this._storeAllowed(s.store)).length.toLocaleString(this._locale()) + ' ' + this.t('stores_suffix'));
    this._setText('stLastSync', this.lastSync ? new Date(this.lastSync).toLocaleString(this._locale()) : '—');

    const regionals = this._allRegionals();
    document.getElementById('panelAccess').hidden = regionals.length < 2;
    if (regionals.length >= 2) {
      const opts = {};
      regionals.forEach(r => { opts[r] = r; });
      this._accessDraft = this.accessRegionals.slice();
      this._initMultiDropdown('accessRegionals', opts, this.accessRegionals, (vals) => { this._accessDraft = vals; },
        { search: regionals.length > 8, allLabel: this.t('dd_all_regionals') });
    }
    this._renderInstall();
  },

  _bindInstall() {
    this._installed = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this._installEvt = e;
      this._renderInstall();
    });
    window.addEventListener('appinstalled', () => {
      this._installEvt = null;
      this._installed = true;
      this._renderInstall();
    });
    this._on('navInstall', 'click', () => this._promptInstall());
    this._renderInstall();
  },
  async _promptInstall() {
    const e = this._installEvt;
    if (!e) return;
    e.prompt();
    try { await e.userChoice; } catch {}
    this._installEvt = null;
    this._renderInstall();
  },
  _renderInstall() {
    document.getElementById('navInstall').hidden = !this._installEvt || this._installed;
    const val = document.getElementById('stInstall');
    const hint = document.getElementById('stInstallHint');
    hint.hidden = true;
    if (this._installed) { val.textContent = this.t('install_done'); return; }
    if (this._installEvt) {
      val.innerHTML = `<button class="btn btn-sm btn-primary" id="btnInstall">${this._esc(this.t('install_btn'))}</button>`;
      document.getElementById('btnInstall').onclick = () => this._promptInstall();
      return;
    }
    val.textContent = '—';
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    hint.textContent = ios ? this.t('install_ios') : this.t('install_manual');
    hint.hidden = false;
  },

  _initDropdown(key, options, current, onChange, opts) {
    const wrap = document.querySelector(`.dropdown-select[data-key="${key}"]`);
    if (!wrap) return;
    opts = opts || {};
    const curVal = current == null ? '' : String(current);
    wrap.dataset.current = curVal;
    const items = Object.entries(options);
    const labelOf = (v) => (typeof v === 'string' ? v : v.label);
    const cur = items.find(([k]) => k === curVal);
    let curLabel;
    if (cur) curLabel = labelOf(cur[1]);
    else if (opts.placeholder) curLabel = opts.placeholder;
    else curLabel = items.length ? labelOf(items[0][1]) : '—';

    const optsHtml = items.map(([k, v]) => {
      const label = labelOf(v);
      const stack = typeof v === 'object' && v.stack ? v.stack : '';
      return `<div class="dd-opt${k === curVal ? ' active' : ''}" data-v="${this._esc(k)}" data-s="${this._esc(String(label).toLowerCase())}"${stack ? ` style="font-family:${this._esc(stack)}"` : ''}>${this._esc(label)}</div>`;
    }).join('');

    wrap.innerHTML = `<button type="button" class="dd-btn${cur ? '' : (opts.placeholder ? ' dd-btn-empty' : '')}"><span class="dd-btn-text">${this._esc(curLabel)}</span><span class="dd-arrow">▾</span></button>
      <div class="dd-menu${opts.search ? ' dd-menu-search' : ''}" hidden>
        ${opts.search ? `<div class="dd-search"><input type="text" class="dd-search-input" placeholder="${this._esc(this.t('search_placeholder'))}" /></div>` : ''}
        <div class="dd-opts">${optsHtml}</div>
        ${opts.search ? `<div class="dd-empty" hidden>${this._esc(this.t('no_result'))}</div>` : ''}
      </div>`;

    const btn = wrap.querySelector('.dd-btn');
    const txt = wrap.querySelector('.dd-btn-text');
    const menu = wrap.querySelector('.dd-menu');
    const input = wrap.querySelector('.dd-search-input');

    menu.onclick = (e) => e.stopPropagation();
    btn.onclick = (e) => {
      e.stopPropagation();
      document.querySelectorAll('.dd-menu').forEach(m => { if (m !== menu) m.hidden = true; });
      menu.hidden = !menu.hidden;
      if (!menu.hidden && input) { input.value = ''; this._ddFilter(wrap, ''); input.focus(); }
    };
    if (input) input.oninput = () => this._ddFilter(wrap, input.value);
    wrap.querySelectorAll('.dd-opt').forEach(el => {
      el.onclick = (e) => {
        e.stopPropagation();
        wrap.dataset.current = el.dataset.v;
        menu.hidden = true;
        btn.classList.remove('dd-btn-empty');
        txt.textContent = el.textContent;
        wrap.querySelectorAll('.dd-opt').forEach(o => o.classList.toggle('active', o === el));
        onChange(el.dataset.v);
      };
    });
    this._bindDdOutside();
  },
  _ddFilter(wrap, q) {
    const needle = String(q || '').trim().toLowerCase();
    let shown = 0;
    wrap.querySelectorAll('.dd-opt').forEach(el => {
      const hit = !needle || el.dataset.s.indexOf(needle) !== -1;
      el.hidden = !hit;
      if (hit) shown++;
    });
    const empty = wrap.querySelector('.dd-empty');
    if (empty) empty.hidden = shown > 0;
  },
  _initMultiDropdown(key, options, selected, onChange, opts) {
    const wrap = document.querySelector(`.dropdown-select[data-key="${key}"]`);
    if (!wrap) return;
    opts = opts || {};
    const items = Object.entries(options);
    const sel = new Set((selected || []).filter(v => options[v] !== undefined));
    const allLabel = opts.allLabel || this.t('all');
    const labelOf = () => {
      if (sel.size === 0 || sel.size === items.length) return allLabel;
      if (sel.size === 1) return String(options[Array.from(sel)[0]]);
      return this.t('dd_n_selected', { n: sel.size });
    };
    const optsHtml = items.map(([k, v]) =>
      `<div class="dd-opt dd-opt-check${sel.has(k) ? ' checked' : ''}" data-v="${this._esc(k)}" data-s="${this._esc(String(v).toLowerCase())}"><span class="dd-box"></span><span>${this._esc(v)}</span></div>`
    ).join('');
    wrap.innerHTML = `<button type="button" class="dd-btn${sel.size ? '' : ' dd-btn-empty'}"><span class="dd-btn-text">${this._esc(labelOf())}</span><span class="dd-arrow">▾</span></button>
      <div class="dd-menu dd-menu-search" hidden>
        <div class="dd-bulk">
          <button type="button" data-bulk="all">${this._esc(this.t('dd_select_all'))}</button>
          <button type="button" data-bulk="none">${this._esc(this.t('dd_clear'))}</button>
        </div>
        ${opts.search ? `<div class="dd-search"><input type="text" class="dd-search-input" placeholder="${this._esc(this.t('search_placeholder'))}" /></div>` : ''}
        <div class="dd-opts">${optsHtml}</div>
        <div class="dd-empty" hidden>${this._esc(this.t('no_result'))}</div>
      </div>`;
    const btn = wrap.querySelector('.dd-btn');
    const menu = wrap.querySelector('.dd-menu');
    const input = wrap.querySelector('.dd-search-input');
    const txt = wrap.querySelector('.dd-btn-text');
    const sync = () => {
      txt.textContent = labelOf();
      btn.classList.toggle('dd-btn-empty', sel.size === 0);
      wrap.querySelectorAll('.dd-opt-check').forEach(o => o.classList.toggle('checked', sel.has(o.dataset.v)));
    };
    const emit = () => onChange(sel.size === items.length ? [] : Array.from(sel));
    menu.onclick = (e) => e.stopPropagation();
    btn.onclick = (e) => {
      e.stopPropagation();
      document.querySelectorAll('.dd-menu').forEach(m => { if (m !== menu) m.hidden = true; });
      menu.hidden = !menu.hidden;
      if (!menu.hidden && input) { input.value = ''; this._ddFilter(wrap, ''); input.focus(); }
    };
    if (input) input.oninput = () => this._ddFilter(wrap, input.value);
    wrap.querySelectorAll('.dd-bulk button').forEach(b => {
      b.onclick = (e) => {
        e.stopPropagation();
        sel.clear();
        if (b.dataset.bulk === 'all') items.forEach(([k]) => sel.add(k));
        sync(); emit();
      };
    });
    wrap.querySelectorAll('.dd-opt-check').forEach(el => {
      el.onclick = (e) => {
        e.stopPropagation();
        const v = el.dataset.v;
        if (sel.has(v)) sel.delete(v); else sel.add(v);
        sync(); emit();
      };
    });
    this._bindDdOutside();
  },
  _bindDdOutside() {
    if (this._ddOutsideBound) return;
    this._ddOutsideBound = true;
    document.addEventListener('click', () => document.querySelectorAll('.dd-menu').forEach(m => m.hidden = true));
  },

  _on(id, event, handler) {
    const el = document.getElementById(id);
    if (!el) { console.warn('Elemen tidak ditemukan: #' + id); return null; }
    el.addEventListener(event, handler);
    return el;
  },
  _setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  },
  _locale() { return this.lang === 'en' ? 'en-US' : 'id-ID'; },
  _toDateStr(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); },
  _formatFull(s) {
    if (!s) return '';
    const [y, m, d] = s.split('-');
    return parseInt(d, 10) + ' ' + this.t('months_full')[parseInt(m, 10) - 1] + ' ' + y;
  },
  _formatDay(s, today) {
    if (!s) return '';
    const [y, m, d] = s.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    const diff = Math.round((dt - new Date(today + 'T00:00:00')) / 86400000);
    if (diff === 0) return this.t('today');
    if (diff === 1) return this.t('tomorrow');
    if (diff === -1) return this.t('yesterday');
    const dow = this.t('days_short')[(dt.getDay() + 6) % 7];
    return dow + ', ' + d + ' ' + this.t('months_short')[m - 1];
  },
  _formatStamp(s) {
    const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
    if (!m) return String(s);
    return this._formatFull(m[1] + '-' + m[2] + '-' + m[3]) + ' ' + m[4] + ':' + m[5];
  },
  _loc(labelObj) {
    if (labelObj == null) return '';
    if (typeof labelObj === 'string') return labelObj;
    return labelObj[this.lang] || labelObj.id || labelObj.en || '';
  },
  _short(b) { const m = String(b || '').match(/^[^-]+-\s*(.+)$/); return m ? m[1].trim() : String(b || ''); },
  _esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); },

  _splash(msg, withRetry) {
    const s = document.getElementById('splash');
    s.classList.remove('hidden');
    const sub = s.querySelector('.splash-sub');
    if (msg) {
      sub.innerHTML = this._esc(msg) + (withRetry ? `<div><button class="btn" id="splashRetry" style="margin-top:14px;">${this._esc(this.t('setting_reload'))}</button></div>` : '');
      const retry = document.getElementById('splashRetry');
      if (retry) retry.onclick = () => {
        sub.innerHTML = `<span>${this._esc(this.t('loading'))}</span><span class="loading-dots"></span>`;
        this.loadAll();
      };
    }
  },
  _splashHide() { setTimeout(() => document.getElementById('splash').classList.add('hidden'), 200); },
  _toast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => t.hidden = true, 3500);
  }
};

document.addEventListener('DOMContentLoaded', () => App.init());

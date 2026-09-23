const Sheets = {
  CACHE_KEY_ACTIVITY: 'jadwalin_kegiatan_v1',
  CACHE_KEY_STORE: 'jadwalin_toko_v1',

  async _get(action, params) {
    if (!CONFIG.APPS_SCRIPT_URL || CONFIG.APPS_SCRIPT_URL.startsWith('PASTE')) throw new Error('APPS_SCRIPT_URL belum dikonfigurasi.');
    const url = new URL(CONFIG.APPS_SCRIPT_URL);
    url.searchParams.set('action', action);
    url.searchParams.set('_t', Date.now());
    if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    const res = await fetch(url.toString());
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const text = await res.text();
    let j; try { j = JSON.parse(text); } catch { throw new Error('Response bukan JSON. Cek Apps Script deployment.'); }
    if (j.status !== 'ok') throw new Error(j.error || 'Fetch gagal');
    return j;
  },
  async _post(body) {
    const res = await fetch(CONFIG.APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const text = await res.text();
    let j; try { j = JSON.parse(text); } catch { throw new Error('Response bukan JSON. Cek Apps Script deployment.'); }
    if (j.status !== 'ok') throw new Error(j.error || 'Simpan gagal');
    return j;
  },

  async fetchAll() {
    const data = (await this._get('fetchAll')).data;
    if (!data || !Array.isArray(data.kegiatan)) {
      throw new Error('Apps Script belum versi Jadwalin. Salin apps-script/Code.gs, lalu Deploy → Manage deployments → Version: New version → Deploy.');
    }
    return data;
  },
  async addActivity(row)      { return (await this._post({ action: 'addKegiatan', row })).data; },
  async updateActivity(row)   { return (await this._post({ action: 'updateKegiatan', row })).data; },

  saveList(key, rows) {
    try { localStorage.setItem(key, JSON.stringify({ ts: Date.now(), data: rows })); }
    catch (e) { console.warn('Cache save failed:', e); }
  },
  loadList(key) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const j = JSON.parse(raw);
      return Array.isArray(j.data) ? { data: j.data, ts: j.ts } : null;
    } catch { return null; }
  },
  clearCache() {
    try {
      localStorage.removeItem(this.CACHE_KEY_ACTIVITY);
      localStorage.removeItem(this.CACHE_KEY_STORE);
    } catch {}
  }
};

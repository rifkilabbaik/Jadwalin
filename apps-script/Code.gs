

const SPREADSHEET_ID = '1wwfqVmS_dn8MhjUc93nDQT-KqDccndoRg4rKwBQpscM';
const SHEETS = { DATA: 'Data', TOKO: 'Daftar Toko', KONTAK: 'Kontak', SAMPAH: 'Sampah' };

// [key, header bawaan, alias header (huruf kecil)]
const DATA_FIELDS = [
  ['id',        'ID',           ['id', 'id kegiatan']],
  ['date',      'Tanggal',      ['tanggal', 'tgl', 'date', 'tanggal kegiatan']],
  ['name',      'Nama',         ['nama', 'nama pencatat', 'dicatat oleh']],
  ['store',     'Nama Toko',    ['nama toko', 'toko', 'nama store', 'store', 'cabang']],
  ['type',      'Kegiatan',     ['kegiatan', 'jenis kegiatan', 'tipe kegiatan']],
  ['k1',        'Keterangan 1', ['keterangan 1', 'keterangan1', 'ket 1']],
  ['k2',        'Keterangan 2', ['keterangan 2', 'keterangan2', 'ket 2']],
  ['picName',   'Nama PIC',     ['nama pic', 'pic']],
  ['picPhone',  'Nomor PIC',    ['nomor pic', 'no pic', 'no. pic', 'no hp pic', 'nomor hp pic', 'telepon pic', 'kontak pic']],
  ['note',      'Keterangan',   ['keterangan', 'catatan']],
  ['status',    'Status',       ['status']],
  ['createdAt', 'Dibuat',       ['dibuat', 'created at', 'timestamp']],
  ['updatedAt', 'Diubah',       ['diubah', 'updated at']]
];
const SAMPAH_FIELDS = DATA_FIELDS.concat([
  ['deletedAt', 'Dihapus',      ['dihapus', 'dihapus pada']],
  ['deletedBy', 'Dihapus oleh', ['dihapus oleh']]
]);
const KONTAK_FIELDS = [
  ['picName',   'Nama PIC',  ['nama pic', 'nama', 'pic']],
  ['picPhone',  'Nomor PIC', ['nomor pic', 'nomor', 'no pic', 'no hp', 'nomor hp', 'telepon']],
  ['store',     'Toko',      ['toko', 'nama toko']],
  ['createdAt', 'Dibuat',    ['dibuat']],
  ['updatedAt', 'Diubah',    ['diubah']]
];
const TOKO_FIELDS = [
  ['regional', 'Regional',  ['regional', 'region']],
  ['area',     'Area',      ['area']],
  ['store',    'Nama Toko', ['nama toko', 'toko', 'nama store', 'store', 'cabang', 'branch']]
];
// Kolom yang disimpan sebagai teks supaya tidak diubah Sheets (tanggal, nol di depan nomor HP).
const TEXT_KEYS = ['date', 'picPhone'];

const STATUSES = ['Terjadwal', 'Selesai', 'Batal'];
const STATUS_ALIASES = {
  'terjadwal': 'Terjadwal', 'dijadwalkan': 'Terjadwal', 'rencana': 'Terjadwal', 'scheduled': 'Terjadwal',
  'selesai': 'Selesai', 'terlaksana': 'Selesai', 'sudah': 'Selesai', 'done': 'Selesai',
  'batal': 'Batal', 'dibatalkan': 'Batal', 'cancel': 'Batal', 'cancelled': 'Batal'
};
const LIMITS = { name: 60, store: 120, type: 40, k1: 140, k2: 140, picName: 60, picPhone: 30, note: 300 };

function doGet(e) {
  return _handle(e, (p) => {
    const a = p.action || 'fetchAll';
    if (a === 'fetchAll') {
      _getSheetSoft(SHEETS.SAMPAH, SAMPAH_FIELDS);
      return { status: 'ok', data: { kegiatan: _fetchKegiatan(), toko: _fetchToko(), kontak: _fetchKontak(), ts: new Date().toISOString() } };
    }
    if (a === 'fetchKegiatan') return { status: 'ok', data: _fetchKegiatan() };
    if (a === 'fetchToko')     return { status: 'ok', data: _fetchToko() };
    if (a === 'fetchKontak')   return { status: 'ok', data: _fetchKontak() };
    if (a === 'status')        return { status: 'ok', data: _status() };
    throw new Error('Unknown action: ' + a);
  });
}

function doPost(e) {
  return _handle(e, () => {
    const b = JSON.parse(e.postData.contents);
    if (b.action === 'addKegiatan')    return { status: 'ok', data: _addKegiatan(b.row || {}) };
    if (b.action === 'updateKegiatan') return { status: 'ok', data: _updateKegiatan(b.row || {}) };
    if (b.action === 'deleteKegiatan') return { status: 'ok', data: _deleteKegiatan(b.id, b.by) };
    throw new Error('Unknown action: ' + b.action);
  });
}

function _handle(e, fn) {
  try { return _json(fn((e && e.parameter) || {})); }
  catch (err) { return _json({ status: 'error', error: err.message }); }
}

let _ssCache = null, _tzCache = null;
function _ss() {
  if (!_ssCache) _ssCache = SPREADSHEET_ID ? SpreadsheetApp.openById(SPREADSHEET_ID) : SpreadsheetApp.getActiveSpreadsheet();
  return _ssCache;
}
function _tz() {
  if (!_tzCache) _tzCache = _ss().getSpreadsheetTimeZone();
  return _tzCache;
}

function _withLock(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try { return fn(); } finally { lock.releaseLock(); }
}

/* ---------- Data ---------- */

function _fetchKegiatan() {
  let sheet = _getSheetSoft(SHEETS.DATA, DATA_FIELDS);
  let ix = _index(sheet, DATA_FIELDS);
  let values = _dataValues(sheet);
  const needsId = ix.col.id === undefined || values.some(r => _hasContent(r, ix) && !String(r[ix.col.id]).trim());
  if (needsId) {
    _withLock(() => {
      sheet = _getSheetSoft(SHEETS.DATA, DATA_FIELDS);
      ix = _index(sheet, DATA_FIELDS, ['id']);
      values = _dataValues(sheet);
      if (!values.length) return;
      const ids = values.map(r => [String(r[ix.col.id] == null ? '' : r[ix.col.id]).trim()]);
      let changed = false;
      values.forEach((r, i) => {
        if (_hasContent(r, ix) && !ids[i][0]) { ids[i][0] = _newId(); r[ix.col.id] = ids[i][0]; changed = true; }
      });
      if (changed) sheet.getRange(2, ix.col.id + 1, ids.length, 1).setValues(ids);
    });
  }
  const out = [];
  values.forEach((r, i) => {
    if (!_hasContent(r, ix)) return;
    out.push(_toRecord(r, ix, i + 2));
  });
  return out;
}

function _addKegiatan(row) {
  const clean = _validate(row);
  return _withLock(() => {
    const sheet = _getSheetSoft(SHEETS.DATA, DATA_FIELDS);
    const ix = _index(sheet, DATA_FIELDS, DATA_FIELDS.map(f => f[0]));
    const now = _now();
    clean.id = _newId();
    clean.status = clean.status || STATUSES[0];
    clean.createdAt = now;
    clean.updatedAt = now;
    const target = sheet.getLastRow() + 1;
    _writeFields(sheet, ix, target, clean, DATA_FIELDS);
    _upsertKontak(clean, now);
    return _toRecord(sheet.getRange(target, 1, 1, ix.width).getValues()[0], ix, target);
  });
}

function _updateKegiatan(row) {
  const id = _str(row.id);
  if (!id) throw new Error('ID kegiatan kosong');
  const clean = _validate(row);
  return _withLock(() => {
    const sheet = _getSheetSoft(SHEETS.DATA, DATA_FIELDS);
    const ix = _index(sheet, DATA_FIELDS, DATA_FIELDS.map(f => f[0]));
    const target = _findRow(sheet, ix, id);
    clean.status = clean.status || STATUSES[0];
    clean.updatedAt = _now();
    _writeFields(sheet, ix, target, clean, DATA_FIELDS);
    _upsertKontak(clean, clean.updatedAt);
    return _toRecord(sheet.getRange(target, 1, 1, ix.width).getValues()[0], ix, target);
  });
}

// Baris yang dihapus dipindah ke sheet Sampah (lengkap dengan waktu & siapa yang menghapus).
function _deleteKegiatan(rawId, by) {
  const id = _str(rawId);
  if (!id) throw new Error('ID kegiatan kosong');
  return _withLock(() => {
    const sheet = _getSheetSoft(SHEETS.DATA, DATA_FIELDS);
    const ix = _index(sheet, DATA_FIELDS, ['id']);
    const target = _findRow(sheet, ix, id);
    const rec = _toRecord(sheet.getRange(target, 1, 1, ix.width).getValues()[0], ix, target);
    delete rec.row;
    rec.deletedAt = _now();
    rec.deletedBy = _str(by).slice(0, LIMITS.name);
    const trash = _getSheetSoft(SHEETS.SAMPAH, SAMPAH_FIELDS);
    const tix = _index(trash, SAMPAH_FIELDS, SAMPAH_FIELDS.map(f => f[0]));
    _writeFields(trash, tix, trash.getLastRow() + 1, rec, SAMPAH_FIELDS);
    sheet.deleteRow(target);
    return { id: id };
  });
}

function _findRow(sheet, ix, id) {
  const last = sheet.getLastRow();
  if (last >= 2) {
    const ids = sheet.getRange(2, ix.col.id + 1, last - 1, 1).getValues();
    for (let i = 0; i < ids.length; i++) {
      if (_str(ids[i][0]) === id) return i + 2;
    }
  }
  throw new Error('Kegiatan tidak ditemukan. Muat ulang data lalu coba lagi.');
}

function _validate(row) {
  const date = _normalizeDate(row.date);
  if (!date) throw new Error('Tanggal kegiatan tidak valid');
  const out = { date: date, status: _normStatus(row.status) };
  ['name', 'store', 'type', 'k1', 'k2', 'picName', 'picPhone', 'note'].forEach(k => {
    out[k] = _str(row[k]).slice(0, LIMITS[k]);
  });
  if (!out.name)  throw new Error('Nama wajib diisi');
  if (!out.store) throw new Error('Nama Toko wajib diisi');
  if (!out.type)  throw new Error('Kegiatan wajib diisi');
  if (out.picPhone && !/^[0-9+()\-.\s]{6,}$/.test(out.picPhone)) throw new Error('Nomor PIC tidak valid');
  return out;
}

function _normStatus(v) {
  const s = _str(v);
  if (!s) return '';
  return STATUS_ALIASES[s.toLowerCase()] || s;
}

function _toRecord(r, ix, rowNum) {
  const at = (k) => (ix.col[k] === undefined ? '' : r[ix.col[k]]);
  return {
    id: _str(at('id')),
    date: _normalizeDate(at('date')) || '',
    name: _str(at('name')),
    store: _str(at('store')),
    type: _str(at('type')),
    k1: _str(at('k1')),
    k2: _str(at('k2')),
    picName: _str(at('picName')),
    picPhone: _str(at('picPhone')),
    note: _str(at('note')),
    status: _normStatus(at('status')) || STATUSES[0],
    createdAt: _stamp(at('createdAt')),
    updatedAt: _stamp(at('updatedAt')),
    row: rowNum
  };
}

function _hasContent(r, ix) {
  return ['date', 'name', 'store', 'type'].some(k => ix.col[k] !== undefined && _str(r[ix.col[k]]) !== '');
}

/* ---------- Kontak ---------- */

function _fetchKontak() {
  const sheet = _getSheetSoft(SHEETS.KONTAK, KONTAK_FIELDS);
  if (sheet.getLastRow() < 2) _backfillKontak();
  return _readKontak(sheet);
}

function _readKontak(sheet) {
  if (sheet.getLastRow() < 2) return [];
  const ix = _index(sheet, KONTAK_FIELDS);
  if (ix.col.picName === undefined) return [];
  return _dataValues(sheet)
    .map(r => ({
      name: _str(r[ix.col.picName]),
      phone: ix.col.picPhone === undefined ? '' : _str(r[ix.col.picPhone]),
      store: ix.col.store === undefined ? '' : _str(r[ix.col.store])
    }))
    .filter(c => c.name);
}

// Isi awal sheet Kontak dari PIC yang sudah tercatat di sheet Data.
function _backfillKontak() {
  const data = _ss().getSheetByName(SHEETS.DATA);
  if (!data || data.getLastRow() < 2) return;
  const ix = _index(data, DATA_FIELDS);
  if (ix.col.picName === undefined) return;
  const recs = _dataValues(data).map(r => _toRecord(r, ix, 0)).filter(r => r.picName);
  if (!recs.length) return;
  _withLock(() => {
    const now = _now();
    recs.forEach(r => _upsertKontak(r, now));
  });
}

// Simpan / perbarui PIC di sheet Kontak (kunci: Nama PIC, tidak peka huruf besar-kecil).
function _upsertKontak(rec, now) {
  const name = _str(rec.picName);
  if (!name) return;
  const sheet = _getSheetSoft(SHEETS.KONTAK, KONTAK_FIELDS);
  const ix = _index(sheet, KONTAK_FIELDS, KONTAK_FIELDS.map(f => f[0]));
  const last = sheet.getLastRow();
  let target = 0, current = null;
  if (last >= 2) {
    const values = sheet.getRange(2, 1, last - 1, ix.width).getValues();
    for (let i = 0; i < values.length; i++) {
      if (_str(values[i][ix.col.picName]).toLowerCase() === name.toLowerCase()) {
        target = i + 2;
        current = values[i];
        break;
      }
    }
  }
  if (!target) {
    _writeFields(sheet, ix, last + 1, { picName: name, picPhone: _str(rec.picPhone), store: _str(rec.store), createdAt: now, updatedAt: now }, KONTAK_FIELDS);
    return;
  }
  const patch = {};
  const phone = _str(rec.picPhone);
  if (phone && phone !== _str(current[ix.col.picPhone])) patch.picPhone = phone;
  if (rec.store && _str(rec.store) !== _str(current[ix.col.store])) patch.store = _str(rec.store);
  if (Object.keys(patch).length) {
    patch.updatedAt = now;
    _writeFields(sheet, ix, target, patch, KONTAK_FIELDS);
  }
}

/* ---------- Daftar Toko ---------- */

function _fetchToko() {
  const sheet = _getSheetSoft(SHEETS.TOKO, TOKO_FIELDS);
  if (sheet.getLastRow() < 2) return [];
  const ix = _index(sheet, TOKO_FIELDS);
  const storeCol = ix.col.store === undefined ? 0 : ix.col.store;
  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, ix.width).getValues();
  const seen = {};
  const out = [];
  values.forEach(r => {
    const store = _str(r[storeCol]);
    if (!store || seen[store.toLowerCase()]) return;
    seen[store.toLowerCase()] = true;
    out.push({
      store: store,
      regional: ix.col.regional === undefined ? '' : _str(r[ix.col.regional]),
      area: ix.col.area === undefined ? '' : _str(r[ix.col.area])
    });
  });
  return out;
}

function _status() {
  const ss = _ss();
  const rows = (name) => { const s = ss.getSheetByName(name); return s ? Math.max(0, s.getLastRow() - 1) : 0; };
  return {
    spreadsheet: ss.getName(),
    dataRows: rows(SHEETS.DATA),
    tokoRows: rows(SHEETS.TOKO),
    kontakRows: rows(SHEETS.KONTAK),
    sampahRows: rows(SHEETS.SAMPAH),
    timestamp: new Date().toISOString()
  };
}

/* ---------- helpers ---------- */

function _dataValues(sheet) {
  const last = sheet.getLastRow();
  if (last < 2) return [];
  return sheet.getRange(2, 1, last - 1, Math.max(sheet.getLastColumn(), 1)).getValues();
}

// Tulis hanya kolom milik aplikasi, dikelompokkan per blok kolom yang bersebelahan,
// supaya kolom tambahan/rumus di sheet tidak tertimpa.
function _writeFields(sheet, ix, rowNum, rec, fields) {
  const cells = fields
    .filter(f => rec[f[0]] !== undefined && ix.col[f[0]] !== undefined)
    .map(f => ({ key: f[0], col: ix.col[f[0]], val: rec[f[0]] }))
    .sort((a, b) => a.col - b.col);
  cells.forEach(c => { if (TEXT_KEYS.indexOf(c.key) >= 0) sheet.getRange(rowNum, c.col + 1).setNumberFormat('@'); });
  let i = 0;
  while (i < cells.length) {
    let j = i;
    while (j + 1 < cells.length && cells[j + 1].col === cells[j].col + 1) j++;
    const block = cells.slice(i, j + 1);
    sheet.getRange(rowNum, block[0].col + 1, 1, block.length).setValues([block.map(c => c.val)]);
    i = j + 1;
  }
}

function _index(sheet, fields, ensureKeys) {
  const width = Math.max(sheet.getLastColumn(), 1);
  const header = sheet.getRange(1, 1, 1, width).getValues()[0].map(h => _str(h).toLowerCase().replace(/\s+/g, ' '));
  const col = {};
  fields.forEach(f => {
    for (let i = 0; i < f[2].length; i++) {
      const c = header.indexOf(f[2][i]);
      if (c >= 0) { col[f[0]] = c; return; }
    }
  });
  let w = header.filter(Boolean).length ? width : 0;
  (ensureKeys || []).forEach(k => {
    if (col[k] !== undefined) return;
    const f = fields.filter(x => x[0] === k)[0];
    w++;
    sheet.getRange(1, w).setValue(f[1]);
    col[k] = w - 1;
  });
  return { col: col, width: Math.max(w, width) };
}

function _getSheetSoft(name, fields) {
  const ss = _ss();
  let s = ss.getSheetByName(name);
  if (!s) s = ss.insertSheet(name);
  if (s.getLastRow() === 0) {
    s.getRange(1, 1, 1, fields.length).setValues([fields.map(f => f[1])]);
    s.setFrozenRows(1);
  }
  return s;
}

function _newId() {
  return 'K' + Date.now().toString(36).toUpperCase() + Math.floor(Math.random() * 46656).toString(36).toUpperCase().padStart(3, '0');
}

function _now() { return Utilities.formatDate(new Date(), _tz(), 'yyyy-MM-dd HH:mm:ss'); }
function _stamp(v) {
  if (v instanceof Date) return Utilities.formatDate(v, _tz(), 'yyyy-MM-dd HH:mm:ss');
  return _str(v);
}

function _normalizeDate(v) {
  if (v instanceof Date) {
    if (isNaN(v)) return null;
    return Utilities.formatDate(v, _tz(), 'yyyy-MM-dd');
  }
  if (typeof v === 'string') {
    let m = v.trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m) return m[1] + '-' + _pad(m[2]) + '-' + _pad(m[3]);
    m = v.trim().match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4})/);
    if (m) return m[3] + '-' + _pad(m[2]) + '-' + _pad(m[1]);
  }
  return null;
}

function _str(v) { return String(v == null ? '' : v).trim(); }
function _pad(s) { return String(s).padStart(2, '0'); }
function _json(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

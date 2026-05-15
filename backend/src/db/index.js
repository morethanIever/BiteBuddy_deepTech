const path = require('path');
const fs   = require('fs');

const DB_PATH = path.join(__dirname, '../../data/bitebuddy.db');
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

let _db = null;
const initSqlJs = require('sql.js');

const initPromise = initSqlJs().then(SQL => {
  _db = fs.existsSync(DB_PATH)
    ? new SQL.Database(fs.readFileSync(DB_PATH))
    : new SQL.Database();
  _db.run('PRAGMA foreign_keys = ON');
});

function save() {
  if (_db) fs.writeFileSync(DB_PATH, Buffer.from(_db.export()));
}
let dirty = false;
setInterval(() => { if (dirty) { save(); dirty = false; } }, 2000);
process.on('exit', save);
process.on('SIGINT', () => { save(); process.exit(0); });

function waitReady() {
  if (!_db) throw new Error('DB not ready');
}
function flatP(params) {
  if (params.length === 1 && params[0] !== null && typeof params[0] === 'object' && !Array.isArray(params[0]))
    return Object.values(params[0]);
  return params;
}
function toObj(cols, row) {
  const o = {};
  cols.forEach((c, i) => { o[c] = row[i]; });
  return o;
}

const db = {
  _initPromise: initPromise,
  pragma() {},
  exec(sql) { waitReady(); _db.run(sql); dirty = true; },
  prepare(sql) {
    return {
      run(...p)  {
        waitReady(); _db.run(sql, flatP(p)); dirty = true;
        const r = _db.exec('SELECT last_insert_rowid() as id');
        return { lastInsertRowid: r[0]?.values[0]?.[0] ?? 0, changes: 1 };
      },
      get(...p)  {
        waitReady();
        const r = _db.exec(sql, flatP(p));
        if (!r[0] || !r[0].values[0]) return undefined;
        return toObj(r[0].columns, r[0].values[0]);
      },
      all(...p)  {
        waitReady();
        const r = _db.exec(sql, flatP(p));
        if (!r[0]) return [];
        return r[0].values.map(row => toObj(r[0].columns, row));
      },
    };
  },
};

function initSchema() {
  waitReady();
  _db.run(`CREATE TABLE IF NOT EXISTS restaurants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL, type TEXT NOT NULL, area TEXT NOT NULL,
    address TEXT, lat REAL NOT NULL, lng REAL NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    score INTEGER DEFAULT NULL, verified_at TEXT DEFAULT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`);
  _db.run(`CREATE TABLE IF NOT EXISTS scans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    restaurant_id INTEGER NOT NULL,
    device_key TEXT,
    ecoli   TEXT NOT NULL DEFAULT 'ND',
    staph   TEXT NOT NULL DEFAULT 'ND',
    bcereus TEXT NOT NULL DEFAULT 'ND',
    result  TEXT NOT NULL,
    score   INTEGER NOT NULL,
    notes   TEXT,
    raw_na  TEXT,
    cfu_data TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`);
  _db.run(`CREATE TABLE IF NOT EXISTS device_keys (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key_value TEXT NOT NULL UNIQUE, label TEXT NOT NULL,
    restaurant_id INTEGER, active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`);
  _db.run(`CREATE TABLE IF NOT EXISTS applications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    restaurant_name TEXT NOT NULL, cuisine_type TEXT, area TEXT NOT NULL,
    contact_email TEXT, contact_phone TEXT, notes TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    progress INTEGER NOT NULL DEFAULT 0,
    contacted_at TEXT DEFAULT NULL,
    admin_notes TEXT DEFAULT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`);

  // Auto-seed demo data when the database is empty
  const rowCount = _db.exec('SELECT COUNT(*) FROM restaurants');
  if ((rowCount[0]?.values[0]?.[0] ?? 0) === 0) {
    try {
      const { seed } = require('../../scripts/seed');
      seed();
      save();
      console.log('✅ Auto-seed complete');
    } catch (e) {
      console.error('Auto-seed failed:', e);
    }
  }

  // Incremental migrations for applications table
  const addAppCol = (sql) => { try { _db.run(sql); } catch (_) {} };
  addAppCol('ALTER TABLE applications ADD COLUMN progress INTEGER NOT NULL DEFAULT 0');
  addAppCol('ALTER TABLE applications ADD COLUMN contacted_at TEXT DEFAULT NULL');
  addAppCol('ALTER TABLE applications ADD COLUMN admin_notes TEXT DEFAULT NULL');

  // Migration: detect old schema (salmonella column) and rebuild scans table
  const tableInfo = _db.exec("PRAGMA table_info(scans)");
  const cols = tableInfo[0] ? tableInfo[0].values.map(r => r[1]) : [];

  if (cols.includes('salmonella')) {
    // Old schema used 'salmonella' instead of 'bcereus' — rebuild with correct schema
    _db.run(`CREATE TABLE scans_v2 (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      restaurant_id INTEGER NOT NULL,
      device_key TEXT,
      ecoli    TEXT NOT NULL DEFAULT 'ND',
      staph    TEXT NOT NULL DEFAULT 'ND',
      bcereus  TEXT NOT NULL DEFAULT 'ND',
      result   TEXT NOT NULL,
      score    INTEGER NOT NULL,
      notes    TEXT,
      raw_na   TEXT,
      cfu_data TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`);
    _db.run(`INSERT INTO scans_v2 (id, restaurant_id, device_key, ecoli, staph, bcereus, result, score, created_at)
             SELECT id, restaurant_id, device_key, ecoli, staph, salmonella, result, score, created_at FROM scans`);
    _db.run(`DROP TABLE scans`);
    _db.run(`ALTER TABLE scans_v2 RENAME TO scans`);
  } else {
    // Incremental column additions for other missing columns
    const addCol = (sql) => { try { _db.run(sql); } catch (_) {} };
    addCol("ALTER TABLE scans ADD COLUMN bcereus  TEXT NOT NULL DEFAULT 'ND'");
    addCol("ALTER TABLE scans ADD COLUMN notes     TEXT");
    addCol("ALTER TABLE scans ADD COLUMN raw_na    TEXT");
    addCol("ALTER TABLE scans ADD COLUMN cfu_data  TEXT");
  }
}

module.exports = { db, initPromise, initSchema };

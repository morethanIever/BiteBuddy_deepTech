const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '../../data/bitebuddy.db');
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

let _db = null;
const initSqlJs = require('sql.js');

const initPromise = initSqlJs().then(SQL => {
  if (fs.existsSync(DB_PATH)) {
    _db = new SQL.Database(fs.readFileSync(DB_PATH));
  } else {
    _db = new SQL.Database();
  }
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
  if (!_db) throw new Error('DB not ready — await db._initPromise first');
}

function flattenParams(params) {
  if (params.length === 1 && params[0] !== null && typeof params[0] === 'object' && !Array.isArray(params[0])) {
    return Object.values(params[0]);
  }
  return params;
}

function rowToObj(cols, row) {
  const obj = {};
  cols.forEach((c, i) => { obj[c] = row[i]; });
  return obj;
}

const db = {
  _initPromise: initPromise,

  pragma() {},

  exec(sql) {
    waitReady();
    _db.run(sql);
    dirty = true;
  },

  prepare(sql) {
    return {
      run(...params) {
        waitReady();
        _db.run(sql, flattenParams(params));
        dirty = true;
        const r = _db.exec('SELECT last_insert_rowid() as id');
        return { lastInsertRowid: r[0]?.values[0]?.[0] ?? 0, changes: 1 };
      },
      get(...params) {
        waitReady();
        const res = _db.exec(sql, flattenParams(params));
        if (!res[0] || !res[0].values[0]) return undefined;
        return rowToObj(res[0].columns, res[0].values[0]);
      },
      all(...params) {
        waitReady();
        const res = _db.exec(sql, flattenParams(params));
        if (!res[0]) return [];
        return res[0].values.map(row => rowToObj(res[0].columns, row));
      },
    };
  },
};

function initSchema() {
  waitReady();
  _db.run(`
    CREATE TABLE IF NOT EXISTS restaurants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL, type TEXT NOT NULL, area TEXT NOT NULL,
      address TEXT, lat REAL NOT NULL, lng REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      score INTEGER DEFAULT NULL, verified_at TEXT DEFAULT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS scans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      restaurant_id INTEGER NOT NULL,
      device_key TEXT,
      salmonella TEXT NOT NULL, ecoli TEXT NOT NULL, staph TEXT NOT NULL,
      result TEXT NOT NULL, score INTEGER NOT NULL, notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS device_keys (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key_value TEXT NOT NULL UNIQUE, label TEXT NOT NULL,
      restaurant_id INTEGER, active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS applications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      restaurant_name TEXT NOT NULL, cuisine_type TEXT, area TEXT NOT NULL,
      contact_email TEXT, contact_phone TEXT, notes TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

module.exports = { db, initPromise, initSchema };

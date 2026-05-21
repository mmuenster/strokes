import initSqlJs from 'sql.js';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DB_PATH || join(__dirname, 'strokes.db');

const SQL = await initSqlJs();

let _db;

function open() {
  if (existsSync(DB_PATH)) {
    _db = new SQL.Database(readFileSync(DB_PATH));
  } else {
    _db = new SQL.Database();
  }
  runMany(`PRAGMA foreign_keys = ON`);
  runMany(`
    CREATE TABLE IF NOT EXISTS rounds (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      course_name TEXT    NOT NULL,
      date        TEXT    NOT NULL,
      notes       TEXT    DEFAULT '',
      profile     TEXT    NOT NULL DEFAULT 'scratch',
      created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS holes (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      round_id  INTEGER NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
      number    INTEGER NOT NULL CHECK(number BETWEEN 1 AND 18),
      par       INTEGER NOT NULL CHECK(par BETWEEN 3 AND 5),
      yardage   INTEGER,
      UNIQUE(round_id, number)
    );

    CREATE TABLE IF NOT EXISTS shots (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      hole_id     INTEGER NOT NULL REFERENCES holes(id) ON DELETE CASCADE,
      sequence    INTEGER NOT NULL,
      category    TEXT    NOT NULL CHECK(category IN ('OTT','APP','ARG','PUTT','PENALTY')),
      dist_start  REAL    NOT NULL CHECK(dist_start >= 0),
      lie_start   TEXT    NOT NULL CHECK(lie_start IN ('TEE','FAIRWAY','ROUGH','SAND','RECOVERY','GREEN','FRINGE','OB','HAZARD')),
      dist_end    REAL    CHECK(dist_end >= 0),
      lie_end     TEXT    CHECK(lie_end IN ('TEE','FAIRWAY','ROUGH','SAND','RECOVERY','GREEN','FRINGE','OB','HAZARD')),
      holed       INTEGER NOT NULL DEFAULT 0 CHECK(holed IN (0, 1)),
      sg          REAL    NOT NULL DEFAULT 0,
      UNIQUE(hole_id, sequence)
    );
  `);
  migrate();
  persist();
}

function migrate() {
  const version = stmtGet('PRAGMA user_version')?.user_version ?? 0;
  if (version >= 1) return;

  // Recreate shots table with expanded lie/category constraints
  _db.run(`
    ALTER TABLE shots RENAME TO shots_old;
    CREATE TABLE shots (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      hole_id     INTEGER NOT NULL REFERENCES holes(id) ON DELETE CASCADE,
      sequence    INTEGER NOT NULL,
      category    TEXT    NOT NULL CHECK(category IN ('OTT','APP','ARG','PUTT','PENALTY')),
      dist_start  REAL    NOT NULL CHECK(dist_start >= 0),
      lie_start   TEXT    NOT NULL CHECK(lie_start IN ('TEE','FAIRWAY','ROUGH','SAND','RECOVERY','GREEN','FRINGE','OB','HAZARD')),
      dist_end    REAL    CHECK(dist_end >= 0),
      lie_end     TEXT    CHECK(lie_end IN ('TEE','FAIRWAY','ROUGH','SAND','RECOVERY','GREEN','FRINGE','OB','HAZARD')),
      holed       INTEGER NOT NULL DEFAULT 0 CHECK(holed IN (0, 1)),
      sg          REAL    NOT NULL DEFAULT 0,
      UNIQUE(hole_id, sequence)
    );
    INSERT INTO shots SELECT * FROM shots_old;
    DROP TABLE shots_old;
    PRAGMA user_version = 1;
  `);
}

function runMany(sql) {
  _db.run(sql);
}

function persist() {
  writeFileSync(DB_PATH, Buffer.from(_db.export()));
}

// Execute a parameterized statement and return all result rows
function stmtAll(sql, params = []) {
  const stmt = _db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

// Execute a parameterized statement and return first row
function stmtGet(sql, params = []) {
  return stmtAll(sql, params)[0];
}

// Execute a mutating statement; return { lastInsertRowid }
function stmtRun(sql, params = []) {
  const stmt = _db.prepare(sql);
  stmt.bind(params);
  stmt.step();
  stmt.free();
  const lastInsertRowid = stmtGet('SELECT last_insert_rowid() AS id')?.id ?? null;
  persist();
  return { lastInsertRowid };
}

// better-sqlite3-compatible façade
const db = {
  prepare(sql) {
    return {
      run: (...params) => stmtRun(sql, params),
      get: (...params) => stmtGet(sql, params),
      all: (...params) => stmtAll(sql, params),
    };
  },
  exec(sql) {
    runMany(sql);
    persist();
  },
  pragma(s) {
    _db.run(`PRAGMA ${s}`);
  },
};

open();

export default db;

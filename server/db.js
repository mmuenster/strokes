import pg from 'pg';

const { Pool } = pg;

// Use SSL for any non-local database (Railway, etc.)
const isLocalDb =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL.includes('localhost') ||
  process.env.DATABASE_URL.includes('127.0.0.1');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isLocalDb ? false : { rejectUnauthorized: false },
});

export async function query(sql, params) {
  const { rows } = await pool.query(sql, params);
  return rows;
}

export async function queryOne(sql, params) {
  const rows = await query(sql, params);
  return rows[0] ?? null;
}

async function init() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS rounds (
      id          SERIAL PRIMARY KEY,
      course_name TEXT    NOT NULL,
      date        TEXT    NOT NULL,
      notes       TEXT    NOT NULL DEFAULT '',
      profile     TEXT    NOT NULL DEFAULT 'scratch',
      created_at  TEXT    NOT NULL DEFAULT to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS')
    );

    CREATE TABLE IF NOT EXISTS holes (
      id        SERIAL PRIMARY KEY,
      round_id  INTEGER NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
      number    INTEGER NOT NULL CHECK(number BETWEEN 1 AND 18),
      par       INTEGER NOT NULL CHECK(par BETWEEN 3 AND 5),
      yardage   INTEGER,
      UNIQUE(round_id, number)
    );

    CREATE TABLE IF NOT EXISTS shots (
      id          SERIAL PRIMARY KEY,
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
}

await init();

export default pool;

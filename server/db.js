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

    CREATE TABLE IF NOT EXISTS courses (
      id    SERIAL PRIMARY KEY,
      name  TEXT NOT NULL,
      city  TEXT NOT NULL DEFAULT '',
      state TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS course_tees (
      id            SERIAL PRIMARY KEY,
      course_id     INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      name          TEXT    NOT NULL,
      gender        TEXT    NOT NULL DEFAULT 'M',
      rating        REAL,
      slope         INTEGER,
      total_yardage INTEGER
    );

    CREATE TABLE IF NOT EXISTS course_holes (
      id      SERIAL PRIMARY KEY,
      tee_id  INTEGER NOT NULL REFERENCES course_tees(id) ON DELETE CASCADE,
      number  INTEGER NOT NULL CHECK(number BETWEEN 1 AND 18),
      par     INTEGER NOT NULL CHECK(par BETWEEN 3 AND 5),
      yardage INTEGER NOT NULL,
      UNIQUE(tee_id, number)
    );
  `);

  await seedCourses();
}

async function seedCourse(name, city, state, tees) {
  const existing = await pool.query('SELECT id FROM courses WHERE name = $1 AND city = $2', [name, city]);
  if (existing.rows.length > 0) return;

  const { rows: [{ id: courseId }] } = await pool.query(
    'INSERT INTO courses (name, city, state) VALUES ($1, $2, $3) RETURNING id',
    [name, city, state]
  );
  for (const tee of tees) {
    const { rows: [{ id: teeId }] } = await pool.query(
      'INSERT INTO course_tees (course_id, name, gender, rating, slope, total_yardage) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id',
      [courseId, tee.name, tee.gender, tee.rating, tee.slope, tee.total]
    );
    for (const h of tee.holes) {
      await pool.query(
        'INSERT INTO course_holes (tee_id, number, par, yardage) VALUES ($1,$2,$3,$4)',
        [teeId, h.n, h.par, h.y]
      );
    }
  }
  console.log(`Seeded course: ${name}`);
}

async function seedCourses() {
  await seedCourse('Paso Robles Golf Club', 'Paso Robles', 'CA', [
    { name: 'Blue', gender: 'M', rating: 69.4, slope: 121, total: 6157,
      holes: [
        {n:1,par:5,y:489},{n:2,par:4,y:401},{n:3,par:5,y:512},{n:4,par:3,y:169},
        {n:5,par:4,y:322},{n:6,par:3,y:225},{n:7,par:4,y:385},{n:8,par:3,y:157},
        {n:9,par:4,y:349},{n:10,par:4,y:469},{n:11,par:4,y:332},{n:12,par:5,y:531},
        {n:13,par:3,y:173},{n:14,par:4,y:402},{n:15,par:4,y:317},{n:16,par:4,y:395},
        {n:17,par:3,y:190},{n:18,par:4,y:339},
      ]},
    { name: 'White', gender: 'M', rating: 67.6, slope: 119, total: 5928,
      holes: [
        {n:1,par:5,y:486},{n:2,par:4,y:381},{n:3,par:5,y:487},{n:4,par:3,y:142},
        {n:5,par:4,y:308},{n:6,par:3,y:217},{n:7,par:4,y:386},{n:8,par:3,y:150},
        {n:9,par:4,y:339},{n:10,par:4,y:451},{n:11,par:4,y:326},{n:12,par:5,y:506},
        {n:13,par:3,y:153},{n:14,par:4,y:397},{n:15,par:4,y:316},{n:16,par:4,y:367},
        {n:17,par:3,y:181},{n:18,par:4,y:335},
      ]},
    { name: 'Gold', gender: 'M', rating: 65.3, slope: 113, total: 5646,
      holes: [
        {n:1,par:5,y:452},{n:2,par:4,y:351},{n:3,par:5,y:477},{n:4,par:3,y:110},
        {n:5,par:4,y:302},{n:6,par:3,y:213},{n:7,par:4,y:384},{n:8,par:3,y:142},
        {n:9,par:4,y:330},{n:10,par:4,y:449},{n:11,par:4,y:307},{n:12,par:5,y:502},
        {n:13,par:3,y:117},{n:14,par:4,y:358},{n:15,par:4,y:305},{n:16,par:4,y:354},
        {n:17,par:3,y:173},{n:18,par:4,y:320},
      ]},
    { name: 'Red', gender: 'F', rating: 69.4, slope: 118, total: 5413,
      holes: [
        {n:1,par:5,y:442},{n:2,par:4,y:347},{n:3,par:5,y:440},{n:4,par:3,y:107},
        {n:5,par:4,y:289},{n:6,par:3,y:199},{n:7,par:4,y:373},{n:8,par:3,y:135},
        {n:9,par:4,y:328},{n:10,par:4,y:410},{n:11,par:4,y:300},{n:12,par:5,y:497},
        {n:13,par:3,y:115},{n:14,par:4,y:358},{n:15,par:4,y:260},{n:16,par:4,y:326},
        {n:17,par:3,y:169},{n:18,par:4,y:318},
      ]},
  ]);

  await seedCourse('Hunter Ranch Golf Course', 'Paso Robles', 'CA', [
    { name: 'Blue', gender: 'M', rating: 72.1, slope: 136, total: 6681,
      holes: [
        {n:1,par:4,y:403},{n:2,par:4,y:426},{n:3,par:3,y:194},{n:4,par:4,y:397},
        {n:5,par:4,y:336},{n:6,par:5,y:504},{n:7,par:5,y:586},{n:8,par:3,y:186},
        {n:9,par:4,y:329},{n:10,par:4,y:313},{n:11,par:4,y:393},{n:12,par:4,y:417},
        {n:13,par:4,y:401},{n:14,par:3,y:184},{n:15,par:5,y:511},{n:16,par:3,y:162},
        {n:17,par:5,y:545},{n:18,par:4,y:394},
      ]},
    { name: 'White', gender: 'M', rating: 70.3, slope: 129, total: 6280,
      holes: [
        {n:1,par:4,y:385},{n:2,par:4,y:399},{n:3,par:3,y:167},{n:4,par:4,y:368},
        {n:5,par:4,y:311},{n:6,par:5,y:488},{n:7,par:5,y:569},{n:8,par:3,y:165},
        {n:9,par:4,y:325},{n:10,par:4,y:310},{n:11,par:4,y:342},{n:12,par:4,y:399},
        {n:13,par:4,y:370},{n:14,par:3,y:157},{n:15,par:5,y:490},{n:16,par:3,y:136},
        {n:17,par:5,y:529},{n:18,par:4,y:370},
      ]},
    { name: 'Combo', gender: 'M', rating: 69.3, slope: 128, total: 6035,
      holes: [
        {n:1,par:4,y:385},{n:2,par:4,y:360},{n:3,par:3,y:167},{n:4,par:4,y:344},
        {n:5,par:4,y:311},{n:6,par:5,y:488},{n:7,par:5,y:496},{n:8,par:3,y:140},
        {n:9,par:4,y:325},{n:10,par:4,y:310},{n:11,par:4,y:342},{n:12,par:4,y:376},
        {n:13,par:4,y:343},{n:14,par:3,y:141},{n:15,par:5,y:490},{n:16,par:3,y:136},
        {n:17,par:5,y:529},{n:18,par:4,y:352},
      ]},
    { name: 'Silver', gender: 'M', rating: 68.0, slope: 123, total: 5711,
      holes: [
        {n:1,par:4,y:371},{n:2,par:4,y:360},{n:3,par:3,y:139},{n:4,par:4,y:344},
        {n:5,par:4,y:278},{n:6,par:5,y:423},{n:7,par:5,y:496},{n:8,par:3,y:140},
        {n:9,par:4,y:288},{n:10,par:4,y:291},{n:11,par:4,y:286},{n:12,par:4,y:376},
        {n:13,par:4,y:343},{n:14,par:3,y:141},{n:15,par:5,y:471},{n:16,par:3,y:120},
        {n:17,par:5,y:492},{n:18,par:4,y:352},
      ]},
    { name: 'Red', gender: 'F', rating: 71.5, slope: 129, total: 5711,
      holes: [
        {n:1,par:4,y:371},{n:2,par:4,y:360},{n:3,par:3,y:139},{n:4,par:4,y:344},
        {n:5,par:4,y:278},{n:6,par:5,y:423},{n:7,par:5,y:496},{n:8,par:3,y:140},
        {n:9,par:4,y:288},{n:10,par:4,y:291},{n:11,par:4,y:286},{n:12,par:4,y:376},
        {n:13,par:4,y:343},{n:14,par:3,y:141},{n:15,par:5,y:471},{n:16,par:3,y:120},
        {n:17,par:5,y:492},{n:18,par:4,y:352},
      ]},
  ]);
}

if (!process.env.DATABASE_URL) {
  console.error('ERROR: DATABASE_URL environment variable is not set.');
  process.exit(1);
}

try {
  await init();
  const [rounds, courses, shots] = await Promise.all([
    pool.query('SELECT COUNT(*) FROM rounds'),
    pool.query('SELECT COUNT(*) FROM courses'),
    pool.query('SELECT COUNT(*) FROM shots'),
  ]);
  console.log(`DB ready — ${rounds.rows[0].count} rounds, ${courses.rows[0].count} courses, ${shots.rows[0].count} shots`);
} catch (err) {
  console.error('ERROR: Failed to connect to database:', err.message);
  console.error('Check that DATABASE_URL is correct and the database is reachable.');
  process.exit(1);
}

export default pool;

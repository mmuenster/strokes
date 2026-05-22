import { Router } from 'express';
import { query, queryOne } from '../db.js';

const router = Router();

// GET /api/courses
router.get('/', async (req, res) => {
  const courses = await query('SELECT * FROM courses ORDER BY name');
  res.json(courses);
});

// GET /api/courses/:id — course with tees and holes
router.get('/:id', async (req, res) => {
  const course = await queryOne('SELECT * FROM courses WHERE id = $1', [req.params.id]);
  if (!course) return res.status(404).json({ error: 'Course not found' });

  const tees = await query(
    'SELECT * FROM course_tees WHERE course_id = $1 ORDER BY total_yardage DESC',
    [course.id]
  );
  for (const tee of tees) {
    tee.holes = await query(
      'SELECT * FROM course_holes WHERE tee_id = $1 ORDER BY number',
      [tee.id]
    );
  }

  res.json({ ...course, tees });
});

// POST /api/courses/lookup — fetch scorecard from golflink
router.post('/lookup', async (req, res) => {
  const { name, city, state } = req.body;
  if (!name?.trim() || !city?.trim() || !state?.trim())
    return res.status(400).json({ error: 'name, city, and state required' });

  const slug = (s) => s.toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, '-');

  const url = `http://www.golflink.com/golf-courses/${state.toLowerCase()}/${slug(city)}/${slug(name)}`;

  let html;
  try {
    const r = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
      redirect: 'follow',
    });
    if (!r.ok) return res.json({ found: false, url });
    html = await r.text();
  } catch (e) {
    return res.status(502).json({ error: 'Failed to fetch course data', detail: e.message });
  }

  const parsed = parseScorecard(html, name.trim(), city.trim(), state.trim());
  if (!parsed) return res.json({ found: false, url });

  res.json({ found: true, ...parsed, url });
});

// POST /api/courses — save a course (from lookup or manual)
router.post('/', async (req, res) => {
  const { name, city = '', state = '', tees = [] } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'name required' });
  if (!tees.length) return res.status(400).json({ error: 'at least one tee required' });

  const course = await queryOne(
    'INSERT INTO courses (name, city, state) VALUES ($1, $2, $3) RETURNING *',
    [name.trim(), city.trim(), state.trim()]
  );

  const createdTees = [];
  for (const tee of tees) {
    const totalYardage = tee.holes.reduce((s, h) => s + Number(h.yardage), 0);
    const ct = await queryOne(
      'INSERT INTO course_tees (course_id, name, gender, rating, slope, total_yardage) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
      [course.id, tee.name, tee.gender ?? 'M', tee.rating || null, tee.slope || null, totalYardage]
    );
    for (const h of tee.holes) {
      await query(
        'INSERT INTO course_holes (tee_id, number, par, yardage) VALUES ($1,$2,$3,$4)',
        [ct.id, h.number, h.par, Number(h.yardage)]
      );
    }
    ct.holes = await query('SELECT * FROM course_holes WHERE tee_id = $1 ORDER BY number', [ct.id]);
    createdTees.push(ct);
  }

  res.status(201).json({ ...course, tees: createdTees });
});

const SKIP_WORDS = new Set(['IN', 'TOT', 'OUT', 'HOLE', 'PAR', 'SCORECARD', 'SWIPE', 'SEE']);

function parseScorecard(html, courseName, city, state) {
  const m = html.match(/id="scorecard"(.*?)id="yardage/s);
  if (!m) return null;

  let text = m[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const is18 = /\bOUT\b/.test(text);

  // Strip header row and any preamble so tee names parse cleanly
  text = text.replace(/\bHOLE\b[\d\s]+(?:OUT\s+[\d\s]+)?IN\s+TOT\s+/, '');
  // Strip any remaining preamble before the first tee entry (e.g. "Scorecard for Course Name")
  text = text.replace(/^.*?(?=[A-Z][a-z]\w+(?:\s+\([A-Za-z]\))?\s+\d+\.\d+\/\d+)/, '');

  // Parse par row
  const parMatch = text.match(/Par\s+([\d ]+)/);
  if (!parMatch) return null;
  const parNums = parMatch[1].trim().split(/\s+/).map(Number);

  let pars18;
  if (is18) {
    pars18 = [...parNums.slice(0, 9), ...parNums.slice(10, 19)];
  } else {
    pars18 = [...parNums.slice(0, 9), ...parNums.slice(0, 9)];
  }

  // Parse each tee row: name rating/slope yardages...
  const teeRegex = /([A-Za-z][A-Za-z ()]*?)\s+(\d+\.\d+)\/(\d+)\s+((?:\d+\s*)+)/g;
  const tees = [];
  let match;

  while ((match = teeRegex.exec(text)) !== null) {
    const rawName = match[1].trim();
    const nameWords = rawName.split(/\s+/);
    if (nameWords.some(w => SKIP_WORDS.has(w.toUpperCase()))) continue;

    const rating = parseFloat(match[2]);
    const slope = parseInt(match[3]);
    const nums = match[4].trim().split(/\s+/).map(Number);

    let yards18;
    if (is18) {
      yards18 = [...nums.slice(0, 9), ...nums.slice(10, 19)];
    } else {
      yards18 = [...nums.slice(0, 9), ...nums.slice(0, 9)];
    }

    if (yards18.length !== 18) continue;
    if (yards18.some(y => y <= 0)) continue;

    const gender = rawName.includes('(L)') ? 'F' : 'M';
    const name = rawName.replace(/\s*\(L\)\s*/g, '').trim();

    const holes = yards18.map((yardage, i) => ({
      number: i + 1,
      par: pars18[i],
      yardage,
    }));

    tees.push({ name, gender, rating, slope, holes });
  }

  if (!tees.length) return null;

  return { name: courseName, city, state, tees };
}

export default router;

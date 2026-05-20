import { Router } from 'express';
import db from '../db.js';

const router = Router();

// GET /api/rounds — list all rounds with SG aggregates
router.get('/', (req, res) => {
  const rounds = db.prepare(`
    SELECT r.*,
      COALESCE(SUM(CASE WHEN s.category='OTT'  THEN s.sg END), 0) AS sg_ott,
      COALESCE(SUM(CASE WHEN s.category='APP'  THEN s.sg END), 0) AS sg_app,
      COALESCE(SUM(CASE WHEN s.category='ARG'  THEN s.sg END), 0) AS sg_arg,
      COALESCE(SUM(CASE WHEN s.category='PUTT' THEN s.sg END), 0) AS sg_putt,
      COALESCE(SUM(s.sg), 0)                                       AS sg_total,
      COUNT(DISTINCT h.id)                                          AS holes_played
    FROM rounds r
    LEFT JOIN holes h ON h.round_id = r.id
    LEFT JOIN shots s ON s.hole_id = h.id
    GROUP BY r.id
    ORDER BY r.date DESC, r.created_at DESC
  `).all();
  res.json(rounds);
});

// GET /api/rounds/:id — round detail with holes and shots
router.get('/:id', (req, res) => {
  const round = db.prepare('SELECT * FROM rounds WHERE id = ?').get(req.params.id);
  if (!round) return res.status(404).json({ error: 'Round not found' });

  const holes = db.prepare('SELECT * FROM holes WHERE round_id = ? ORDER BY number').all(round.id);
  for (const hole of holes) {
    hole.shots = db.prepare('SELECT * FROM shots WHERE hole_id = ? ORDER BY sequence').all(hole.id);
  }

  const sg = db.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN s.category='OTT'  THEN s.sg END), 0) AS ott,
      COALESCE(SUM(CASE WHEN s.category='APP'  THEN s.sg END), 0) AS app,
      COALESCE(SUM(CASE WHEN s.category='ARG'  THEN s.sg END), 0) AS arg,
      COALESCE(SUM(CASE WHEN s.category='PUTT' THEN s.sg END), 0) AS putt,
      COALESCE(SUM(s.sg), 0)                                       AS total
    FROM shots s
    JOIN holes h ON h.id = s.hole_id
    WHERE h.round_id = ?
  `).get(round.id);

  res.json({ ...round, holes, sg });
});

// POST /api/rounds
router.post('/', (req, res) => {
  const { course_name, date, notes = '', profile = 'scratch' } = req.body;
  if (!course_name?.trim()) return res.status(400).json({ error: 'course_name required' });
  if (!date) return res.status(400).json({ error: 'date required' });
  if (!['scratch', 'hdcp15'].includes(profile)) return res.status(400).json({ error: 'invalid profile' });

  const { lastInsertRowid } = db.prepare(
    'INSERT INTO rounds (course_name, date, notes, profile) VALUES (?, ?, ?, ?)'
  ).run(course_name.trim(), date, notes, profile);

  res.status(201).json(db.prepare('SELECT * FROM rounds WHERE id = ?').get(lastInsertRowid));
});

// PUT /api/rounds/:id
router.put('/:id', (req, res) => {
  const round = db.prepare('SELECT * FROM rounds WHERE id = ?').get(req.params.id);
  if (!round) return res.status(404).json({ error: 'Round not found' });

  const { course_name, date, notes, profile } = req.body;
  if (profile && !['scratch', 'hdcp15'].includes(profile)) return res.status(400).json({ error: 'invalid profile' });

  db.prepare(`
    UPDATE rounds SET
      course_name = COALESCE(?, course_name),
      date        = COALESCE(?, date),
      notes       = COALESCE(?, notes),
      profile     = COALESCE(?, profile)
    WHERE id = ?
  `).run(course_name ?? null, date ?? null, notes ?? null, profile ?? null, round.id);

  res.json(db.prepare('SELECT * FROM rounds WHERE id = ?').get(round.id));
});

// DELETE /api/rounds/:id
router.delete('/:id', (req, res) => {
  const round = db.prepare('SELECT * FROM rounds WHERE id = ?').get(req.params.id);
  if (!round) return res.status(404).json({ error: 'Round not found' });
  db.prepare('DELETE FROM rounds WHERE id = ?').run(round.id);
  res.status(204).end();
});

export default router;

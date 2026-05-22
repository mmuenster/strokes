import { Router } from 'express';
import { query, queryOne } from '../db.js';

const router = Router();

// GET /api/rounds — list all rounds with SG aggregates
router.get('/', async (req, res) => {
  const rounds = await query(`
    SELECT r.*,
      COALESCE(SUM(CASE WHEN s.category='OTT'  THEN s.sg END), 0) AS sg_ott,
      COALESCE(SUM(CASE WHEN s.category='APP'  THEN s.sg END), 0) AS sg_app,
      COALESCE(SUM(CASE WHEN s.category='ARG'  THEN s.sg END), 0) AS sg_arg,
      COALESCE(SUM(CASE WHEN s.category='PUTT' THEN s.sg END), 0) AS sg_putt,
      COALESCE(SUM(s.sg), 0)                                       AS sg_total,
      COUNT(s.id)                                                  AS total_strokes,
      COUNT(DISTINCT CASE WHEN s.id IS NOT NULL THEN h.id END)     AS holes_played,
      COALESCE((
        SELECT SUM(h2.par) FROM holes h2
        WHERE h2.round_id = r.id
        AND EXISTS (SELECT 1 FROM shots s2 WHERE s2.hole_id = h2.id)
      ), 0)                                                        AS played_par
    FROM rounds r
    LEFT JOIN holes h ON h.round_id = r.id
    LEFT JOIN shots s ON s.hole_id = h.id
    GROUP BY r.id
    ORDER BY r.date DESC, r.created_at DESC
  `);
  res.json(rounds);
});

// GET /api/rounds/:id — round detail with holes and shots
router.get('/:id', async (req, res) => {
  const round = await queryOne('SELECT * FROM rounds WHERE id = $1', [req.params.id]);
  if (!round) return res.status(404).json({ error: 'Round not found' });

  const holes = await query('SELECT * FROM holes WHERE round_id = $1 ORDER BY number', [round.id]);
  for (const hole of holes) {
    hole.shots = await query('SELECT * FROM shots WHERE hole_id = $1 ORDER BY sequence', [hole.id]);
  }

  const sg = await queryOne(`
    SELECT
      COALESCE(SUM(CASE WHEN s.category='OTT'  THEN s.sg END), 0) AS ott,
      COALESCE(SUM(CASE WHEN s.category='APP'  THEN s.sg END), 0) AS app,
      COALESCE(SUM(CASE WHEN s.category='ARG'  THEN s.sg END), 0) AS arg,
      COALESCE(SUM(CASE WHEN s.category='PUTT' THEN s.sg END), 0) AS putt,
      COALESCE(SUM(s.sg), 0)                                       AS total
    FROM shots s
    JOIN holes h ON h.id = s.hole_id
    WHERE h.round_id = $1
  `, [round.id]);

  res.json({ ...round, holes, sg });
});

// POST /api/rounds
router.post('/', async (req, res) => {
  const { course_name, date, notes = '', profile = 'scratch', course_tee_id } = req.body;
  if (!course_name?.trim()) return res.status(400).json({ error: 'course_name required' });
  if (!date) return res.status(400).json({ error: 'date required' });
  if (!['scratch', 'hdcp15'].includes(profile)) return res.status(400).json({ error: 'invalid profile' });

  const round = await queryOne(
    'INSERT INTO rounds (course_name, date, notes, profile) VALUES ($1, $2, $3, $4) RETURNING *',
    [course_name.trim(), date, notes, profile]
  );

  if (course_tee_id) {
    const courseHoles = await query(
      'SELECT * FROM course_holes WHERE tee_id = $1 ORDER BY number',
      [course_tee_id]
    );
    for (const ch of courseHoles) {
      await query(
        'INSERT INTO holes (round_id, number, par, yardage) VALUES ($1, $2, $3, $4)',
        [round.id, ch.number, ch.par, ch.yardage]
      );
    }
  }

  res.status(201).json(round);
});

// PUT /api/rounds/:id
router.put('/:id', async (req, res) => {
  const round = await queryOne('SELECT * FROM rounds WHERE id = $1', [req.params.id]);
  if (!round) return res.status(404).json({ error: 'Round not found' });

  const { course_name, date, notes, profile } = req.body;
  if (profile && !['scratch', 'hdcp15'].includes(profile)) return res.status(400).json({ error: 'invalid profile' });

  const updated = await queryOne(`
    UPDATE rounds SET
      course_name = COALESCE($1, course_name),
      date        = COALESCE($2, date),
      notes       = COALESCE($3, notes),
      profile     = COALESCE($4, profile)
    WHERE id = $5
    RETURNING *
  `, [course_name ?? null, date ?? null, notes ?? null, profile ?? null, round.id]);

  res.json(updated);
});

// DELETE /api/rounds/:id
router.delete('/:id', async (req, res) => {
  const round = await queryOne('SELECT * FROM rounds WHERE id = $1', [req.params.id]);
  if (!round) return res.status(404).json({ error: 'Round not found' });
  await query('DELETE FROM rounds WHERE id = $1', [round.id]);
  res.status(204).end();
});

export default router;

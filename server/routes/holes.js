import { Router } from 'express';
import db from '../db.js';

const router = Router({ mergeParams: true });

// GET /api/rounds/:roundId/holes
router.get('/', (req, res) => {
  const holes = db.prepare(`
    SELECT h.*, COUNT(s.id) AS shot_count,
      COALESCE(SUM(s.sg), 0) AS sg_total
    FROM holes h
    LEFT JOIN shots s ON s.hole_id = h.id
    WHERE h.round_id = ?
    GROUP BY h.id
    ORDER BY h.number
  `).all(req.params.roundId);
  res.json(holes);
});

// POST /api/rounds/:roundId/holes
router.post('/', (req, res) => {
  const round = db.prepare('SELECT * FROM rounds WHERE id = ?').get(req.params.roundId);
  if (!round) return res.status(404).json({ error: 'Round not found' });

  const { number, par, yardage } = req.body;
  if (!number || number < 1 || number > 18) return res.status(400).json({ error: 'number must be 1-18' });
  if (!par || ![3, 4, 5].includes(Number(par))) return res.status(400).json({ error: 'par must be 3, 4, or 5' });

  try {
    const { lastInsertRowid } = db.prepare(
      'INSERT INTO holes (round_id, number, par, yardage) VALUES (?, ?, ?, ?)'
    ).run(round.id, Number(number), Number(par), yardage ? Number(yardage) : null);
    const hole = db.prepare('SELECT * FROM holes WHERE id = ?').get(lastInsertRowid);
    hole.shots = [];
    res.status(201).json(hole);
  } catch (e) {
    if (e.message.includes('UNIQUE')) return res.status(409).json({ error: `Hole ${number} already exists` });
    throw e;
  }
});

// PUT /api/holes/:id
router.put('/:id', (req, res) => {
  const hole = db.prepare('SELECT * FROM holes WHERE id = ?').get(req.params.id);
  if (!hole) return res.status(404).json({ error: 'Hole not found' });

  const { par, yardage } = req.body;
  if (par && ![3, 4, 5].includes(Number(par))) return res.status(400).json({ error: 'par must be 3, 4, or 5' });

  db.prepare('UPDATE holes SET par = COALESCE(?, par), yardage = COALESCE(?, yardage) WHERE id = ?')
    .run(par ? Number(par) : null, yardage != null ? Number(yardage) : null, hole.id);

  res.json(db.prepare('SELECT * FROM holes WHERE id = ?').get(hole.id));
});

// DELETE /api/holes/:id
router.delete('/:id', (req, res) => {
  const hole = db.prepare('SELECT * FROM holes WHERE id = ?').get(req.params.id);
  if (!hole) return res.status(404).json({ error: 'Hole not found' });
  db.prepare('DELETE FROM holes WHERE id = ?').run(hole.id);
  res.status(204).end();
});

export default router;

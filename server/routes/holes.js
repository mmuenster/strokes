import { Router } from 'express';
import { query, queryOne } from '../db.js';

const router = Router({ mergeParams: true });

// GET /api/rounds/:roundId/holes
router.get('/', async (req, res) => {
  const holes = await query(`
    SELECT h.*, COUNT(s.id) AS shot_count,
      COALESCE(SUM(s.sg), 0) AS sg_total
    FROM holes h
    LEFT JOIN shots s ON s.hole_id = h.id
    WHERE h.round_id = $1
    GROUP BY h.id
    ORDER BY h.number
  `, [req.params.roundId]);
  res.json(holes);
});

// POST /api/rounds/:roundId/holes
router.post('/', async (req, res) => {
  const round = await queryOne('SELECT * FROM rounds WHERE id = $1', [req.params.roundId]);
  if (!round) return res.status(404).json({ error: 'Round not found' });

  const { number, par, yardage } = req.body;
  if (!number || number < 1 || number > 18) return res.status(400).json({ error: 'number must be 1-18' });
  if (!par || ![3, 4, 5].includes(Number(par))) return res.status(400).json({ error: 'par must be 3, 4, or 5' });

  try {
    const hole = await queryOne(
      'INSERT INTO holes (round_id, number, par, yardage) VALUES ($1, $2, $3, $4) RETURNING *',
      [round.id, Number(number), Number(par), yardage ? Number(yardage) : null]
    );
    hole.shots = [];
    res.status(201).json(hole);
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: `Hole ${number} already exists` });
    throw e;
  }
});

// PUT /api/holes/:id
router.put('/:id', async (req, res) => {
  const hole = await queryOne('SELECT * FROM holes WHERE id = $1', [req.params.id]);
  if (!hole) return res.status(404).json({ error: 'Hole not found' });

  const { par, yardage } = req.body;
  if (par && ![3, 4, 5].includes(Number(par))) return res.status(400).json({ error: 'par must be 3, 4, or 5' });

  const updated = await queryOne(
    'UPDATE holes SET par = COALESCE($1, par), yardage = COALESCE($2, yardage) WHERE id = $3 RETURNING *',
    [par ? Number(par) : null, yardage != null ? Number(yardage) : null, hole.id]
  );
  res.json(updated);
});

// DELETE /api/holes/:id
router.delete('/:id', async (req, res) => {
  const hole = await queryOne('SELECT * FROM holes WHERE id = $1', [req.params.id]);
  if (!hole) return res.status(404).json({ error: 'Hole not found' });
  await query('DELETE FROM holes WHERE id = $1', [hole.id]);
  res.status(204).end();
});

export default router;

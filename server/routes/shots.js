import { Router } from 'express';
import { query, queryOne } from '../db.js';
import { autoCategory, computeSG } from '../sg.js';
import { validateDistance } from '../baseline.js';

const router = Router({ mergeParams: true });

async function getRoundProfile(holeId) {
  const result = await queryOne(`
    SELECT r.profile FROM rounds r
    JOIN holes h ON h.round_id = r.id
    WHERE h.id = $1
  `, [holeId]);
  return result?.profile ?? 'scratch';
}

// GET /api/holes/:holeId/shots
router.get('/', async (req, res) => {
  const shots = await query(
    'SELECT * FROM shots WHERE hole_id = $1 ORDER BY sequence',
    [req.params.holeId]
  );
  res.json(shots);
});

// POST /api/holes/:holeId/shots
router.post('/', async (req, res) => {
  const hole = await queryOne('SELECT * FROM holes WHERE id = $1', [req.params.holeId]);
  if (!hole) return res.status(404).json({ error: 'Hole not found' });

  let { sequence, dist_start, lie_start, dist_end, lie_end, holed = 0, category } = req.body;

  holed = holed ? 1 : 0;

  if (!validateDistance(Number(dist_start))) {
    return res.status(400).json({ error: 'dist_start must be a non-negative number' });
  }
  if (!holed && !validateDistance(Number(dist_end))) {
    return res.status(400).json({ error: 'dist_end required when not holed' });
  }

  const LIES = ['TEE','FAIRWAY','ROUGH','SAND','RECOVERY','GREEN','FRINGE','OB','HAZARD'];
  if (!LIES.includes(lie_start)) return res.status(400).json({ error: 'invalid lie_start' });
  if (!holed && !LIES.includes(lie_end)) return res.status(400).json({ error: 'invalid lie_end' });

  if (!sequence) {
    const last = await queryOne('SELECT MAX(sequence) AS max FROM shots WHERE hole_id = $1', [hole.id]);
    sequence = (last?.max ?? 0) + 1;
  }

  if (!category) {
    category = autoCategory(sequence, lie_start, Number(dist_start), hole.par);
  }

  const CATS = ['OTT','APP','ARG','PUTT','PENALTY'];
  if (!CATS.includes(category)) return res.status(400).json({ error: 'invalid category' });

  const profile = await getRoundProfile(hole.id);
  const sg = computeSG(
    Number(dist_start), lie_start,
    holed ? 0 : Number(dist_end), holed ? 'GREEN' : lie_end,
    holed, profile
  );

  try {
    const shot = await queryOne(`
      INSERT INTO shots (hole_id, sequence, category, dist_start, lie_start, dist_end, lie_end, holed, sg)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [
      hole.id, sequence, category,
      Number(dist_start), lie_start,
      holed ? null : Number(dist_end),
      holed ? null : lie_end,
      holed, sg,
    ]);
    res.status(201).json(shot);
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: `Shot ${sequence} already exists` });
    throw e;
  }
});

// PUT /api/shots/:id
router.put('/:id', async (req, res) => {
  const shot = await queryOne('SELECT * FROM shots WHERE id = $1', [req.params.id]);
  if (!shot) return res.status(404).json({ error: 'Shot not found' });

  let { dist_start, lie_start, dist_end, lie_end, holed, category } = req.body;
  holed = holed != null ? (holed ? 1 : 0) : shot.holed;

  const newDistStart = dist_start != null ? Number(dist_start) : shot.dist_start;
  const newLieStart  = lie_start ?? shot.lie_start;
  const newDistEnd   = dist_end != null ? Number(dist_end) : shot.dist_end;
  const newLieEnd    = lie_end ?? shot.lie_end;

  if (!validateDistance(newDistStart)) return res.status(400).json({ error: 'invalid dist_start' });
  if (!holed && !validateDistance(newDistEnd)) return res.status(400).json({ error: 'invalid dist_end' });

  const profile = await getRoundProfile(shot.hole_id);
  const sg = computeSG(newDistStart, newLieStart, holed ? 0 : newDistEnd, holed ? 'GREEN' : newLieEnd, holed, profile);

  const hole = await queryOne('SELECT * FROM holes WHERE id = $1', [shot.hole_id]);
  const newCategory = category ?? autoCategory(shot.sequence, newLieStart, newDistStart, hole.par);

  const updated = await queryOne(`
    UPDATE shots SET
      dist_start = $1, lie_start = $2,
      dist_end   = $3, lie_end   = $4,
      holed = $5, category = $6, sg = $7
    WHERE id = $8
    RETURNING *
  `, [
    newDistStart, newLieStart,
    holed ? null : newDistEnd,
    holed ? null : newLieEnd,
    holed, newCategory, sg, shot.id,
  ]);

  res.json(updated);
});

// DELETE /api/shots/:id
router.delete('/:id', async (req, res) => {
  const shot = await queryOne('SELECT * FROM shots WHERE id = $1', [req.params.id]);
  if (!shot) return res.status(404).json({ error: 'Shot not found' });
  await query('DELETE FROM shots WHERE id = $1', [shot.id]);
  res.status(204).end();
});

export default router;

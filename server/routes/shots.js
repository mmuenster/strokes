import { Router } from 'express';
import db from '../db.js';
import { autoCategory, computeSG } from '../sg.js';
import { validateDistance } from '../baseline.js';

const router = Router({ mergeParams: true });

function getRoundProfile(holeId) {
  const result = db.prepare(`
    SELECT r.profile FROM rounds r
    JOIN holes h ON h.round_id = r.id
    WHERE h.id = ?
  `).get(holeId);
  return result?.profile ?? 'scratch';
}

// GET /api/holes/:holeId/shots
router.get('/', (req, res) => {
  const shots = db.prepare(
    'SELECT * FROM shots WHERE hole_id = ? ORDER BY sequence'
  ).all(req.params.holeId);
  res.json(shots);
});

// POST /api/holes/:holeId/shots
router.post('/', (req, res) => {
  const hole = db.prepare('SELECT * FROM holes WHERE id = ?').get(req.params.holeId);
  if (!hole) return res.status(404).json({ error: 'Hole not found' });

  let { sequence, dist_start, lie_start, dist_end, lie_end, holed = 0, category } = req.body;

  holed = holed ? 1 : 0;

  if (!validateDistance(Number(dist_start))) {
    return res.status(400).json({ error: 'dist_start must be a non-negative number' });
  }
  if (!holed && !validateDistance(Number(dist_end))) {
    return res.status(400).json({ error: 'dist_end required when not holed' });
  }

  const LIES = ['TEE','FAIRWAY','ROUGH','SAND','RECOVERY','GREEN','FRINGE'];
  if (!LIES.includes(lie_start)) return res.status(400).json({ error: 'invalid lie_start' });
  if (!holed && !LIES.includes(lie_end)) return res.status(400).json({ error: 'invalid lie_end' });

  // Auto-assign sequence if not provided
  if (!sequence) {
    const last = db.prepare('SELECT MAX(sequence) AS max FROM shots WHERE hole_id = ?').get(hole.id);
    sequence = (last?.max ?? 0) + 1;
  }

  // Auto-categorize if not provided
  if (!category) {
    category = autoCategory(sequence, lie_start, Number(dist_start), hole.par);
  }

  const CATS = ['OTT','APP','ARG','PUTT'];
  if (!CATS.includes(category)) return res.status(400).json({ error: 'invalid category' });

  const profile = getRoundProfile(hole.id);
  const sg = computeSG(
    Number(dist_start), lie_start,
    holed ? 0 : Number(dist_end), holed ? 'GREEN' : lie_end,
    holed, profile
  );

  try {
    const { lastInsertRowid } = db.prepare(`
      INSERT INTO shots (hole_id, sequence, category, dist_start, lie_start, dist_end, lie_end, holed, sg)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      hole.id, sequence, category,
      Number(dist_start), lie_start,
      holed ? null : Number(dist_end),
      holed ? null : lie_end,
      holed, sg
    );
    res.status(201).json(db.prepare('SELECT * FROM shots WHERE id = ?').get(lastInsertRowid));
  } catch (e) {
    if (e.message.includes('UNIQUE')) return res.status(409).json({ error: `Shot ${sequence} already exists` });
    throw e;
  }
});

// PUT /api/shots/:id
router.put('/:id', (req, res) => {
  const shot = db.prepare('SELECT * FROM shots WHERE id = ?').get(req.params.id);
  if (!shot) return res.status(404).json({ error: 'Shot not found' });

  let { dist_start, lie_start, dist_end, lie_end, holed, category } = req.body;
  holed = holed != null ? (holed ? 1 : 0) : shot.holed;

  const newDistStart = dist_start != null ? Number(dist_start) : shot.dist_start;
  const newLieStart  = lie_start ?? shot.lie_start;
  const newDistEnd   = dist_end != null ? Number(dist_end) : shot.dist_end;
  const newLieEnd    = lie_end ?? shot.lie_end;

  if (!validateDistance(newDistStart)) return res.status(400).json({ error: 'invalid dist_start' });
  if (!holed && !validateDistance(newDistEnd)) return res.status(400).json({ error: 'invalid dist_end' });

  const profile = getRoundProfile(shot.hole_id);
  const sg = computeSG(newDistStart, newLieStart, holed ? 0 : newDistEnd, holed ? 'GREEN' : newLieEnd, holed, profile);

  const hole = db.prepare('SELECT * FROM holes WHERE id = ?').get(shot.hole_id);
  const newCategory = category ?? autoCategory(shot.sequence, newLieStart, newDistStart, hole.par);

  db.prepare(`
    UPDATE shots SET
      dist_start = ?, lie_start = ?,
      dist_end   = ?, lie_end   = ?,
      holed = ?, category = ?, sg = ?
    WHERE id = ?
  `).run(
    newDistStart, newLieStart,
    holed ? null : newDistEnd,
    holed ? null : newLieEnd,
    holed, newCategory, sg, shot.id
  );

  res.json(db.prepare('SELECT * FROM shots WHERE id = ?').get(shot.id));
});

// DELETE /api/shots/:id
router.delete('/:id', (req, res) => {
  const shot = db.prepare('SELECT * FROM shots WHERE id = ?').get(req.params.id);
  if (!shot) return res.status(404).json({ error: 'Shot not found' });
  db.prepare('DELETE FROM shots WHERE id = ?').run(shot.id);
  res.status(204).end();
});

export default router;

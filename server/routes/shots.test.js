import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

// In-memory fixtures standing in for the Postgres tables shots.js reads from.
// Route params arrive as strings (Express URL params) while fixture ids are
// numbers, so every id comparison below goes through this to match Postgres's
// (type-coercing) behavior rather than JS's strict equality.
const eq = (a, b) => String(a) === String(b);

let holes;
let shots;
let nextShotId;

vi.mock('../db.js', () => ({
  query: vi.fn(async (sql, params) => {
    if (sql.includes('FROM shots WHERE hole_id')) {
      return shots.filter((s) => eq(s.hole_id, params[0])).sort((a, b) => a.sequence - b.sequence);
    }
    if (sql.includes('SELECT MAX(sequence)')) {
      const rows = shots.filter((s) => eq(s.hole_id, params[0]));
      return [{ max: rows.length ? Math.max(...rows.map((s) => s.sequence)) : null }];
    }
    throw new Error(`Unmocked query(): ${sql}`);
  }),
  queryOne: vi.fn(async (sql, params) => {
    if (sql.includes('FROM shots WHERE id')) {
      return shots.find((s) => eq(s.id, params[0])) ?? null;
    }
    if (sql.includes('FROM rounds r')) {
      const hole = holes.find((h) => eq(h.id, params[0]));
      return hole ? { profile: hole.profile ?? 'scratch' } : null;
    }
    if (sql.includes('FROM holes WHERE id')) {
      return holes.find((h) => eq(h.id, params[0])) ?? null;
    }
    if (sql.startsWith('SELECT MAX(sequence)')) {
      const rows = shots.filter((s) => eq(s.hole_id, params[0]));
      return { max: rows.length ? Math.max(...rows.map((s) => s.sequence)) : null };
    }
    if (sql.trim().startsWith('INSERT INTO shots')) {
      const [hole_id, sequence, category, dist_start, lie_start, dist_end, lie_end, holed, sg] = params;
      const shot = { id: nextShotId++, hole_id, sequence, category, dist_start, lie_start, dist_end, lie_end, holed, sg };
      shots.push(shot);
      return shot;
    }
    if (sql.trim().startsWith('UPDATE shots SET')) {
      const [dist_start, lie_start, dist_end, lie_end, holed, category, sg, id] = params;
      const idx = shots.findIndex((s) => eq(s.id, id));
      shots[idx] = { ...shots[idx], dist_start, lie_start, dist_end, lie_end, holed, category, sg };
      return shots[idx];
    }
    throw new Error(`Unmocked queryOne(): ${sql}`);
  }),
}));

const { default: shotsRouter } = await import('./shots.js');

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/holes/:holeId/shots', shotsRouter);
  app.use('/api/shots', shotsRouter);
  return app;
}

beforeEach(() => {
  holes = [{ id: 1, round_id: 1, par: 4, profile: 'scratch' }];
  shots = [];
  nextShotId = 1;
});

describe('PUT /api/shots/:id — dist_start preservation', () => {
  it('leaves dist_start/lie_start untouched when the payload omits them', async () => {
    // Shot 1: approach ending on the green 2.4ft (0.8yd) from the hole.
    // Shot 2: a putt from that spot, initially recorded as holed.
    shots = [
      { id: 1, hole_id: 1, sequence: 1, category: 'APP', dist_start: 150, lie_start: 'FAIRWAY', dist_end: 0.8, lie_end: 'GREEN', holed: 0, sg: 0 },
      { id: 2, hole_id: 1, sequence: 2, category: 'PUTT', dist_start: 0.8, lie_start: 'GREEN', dist_end: null, lie_end: null, holed: 1, sg: 0 },
    ];
    const app = buildApp();

    // Client now correctly omits dist_start/lie_start for a continuation shot
    // when editing it — here, changing the putt from holed to a 2ft miss.
    const res = await request(app)
      .put('/api/shots/2')
      .send({ holed: 0, dist_end: 2 / 3, lie_end: 'GREEN' });

    expect(res.status).toBe(200);
    expect(res.body.dist_start).toBe(0.8);
    expect(res.body.lie_start).toBe('GREEN');
    expect(res.body.dist_end).toBeCloseTo(2 / 3, 6);
    expect(res.body.holed).toBe(0);
  });

  it('does update dist_start when the payload explicitly includes it (first shot)', async () => {
    shots = [
      { id: 1, hole_id: 1, sequence: 1, category: 'OTT', dist_start: 400, lie_start: 'TEE', dist_end: 150, lie_end: 'FAIRWAY', holed: 0, sg: 0 },
    ];
    const app = buildApp();

    const res = await request(app)
      .put('/api/shots/1')
      .send({ dist_start: 410, lie_start: 'TEE', dist_end: 150, lie_end: 'FAIRWAY' });

    expect(res.status).toBe(200);
    expect(res.body.dist_start).toBe(410);
  });

  it('recomputes sg from the preserved dist_start, not a stale value', async () => {
    shots = [
      { id: 1, hole_id: 1, sequence: 1, category: 'APP', dist_start: 150, lie_start: 'FAIRWAY', dist_end: 0.8, lie_end: 'GREEN', holed: 0, sg: 0 },
      { id: 2, hole_id: 1, sequence: 2, category: 'PUTT', dist_start: 0.8, lie_start: 'GREEN', dist_end: null, lie_end: null, holed: 1, sg: 999 },
    ];
    const app = buildApp();

    const res = await request(app)
      .put('/api/shots/2')
      .send({ holed: 1 });

    // Making a putt from 0.8yd (2.4ft) should be a small positive number,
    // not the stale placeholder sg the shot started with.
    expect(res.body.sg).not.toBe(999);
    expect(res.body.sg).toBeGreaterThan(0);
    expect(res.body.sg).toBeLessThan(0.2);
  });
});

describe('POST /api/holes/:holeId/shots', () => {
  it('auto-categorizes and computes sg for a new shot', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/holes/1/shots')
      .send({ dist_start: 400, lie_start: 'TEE', dist_end: 150, lie_end: 'FAIRWAY' });

    expect(res.status).toBe(201);
    expect(res.body.category).toBe('OTT');
    expect(typeof res.body.sg).toBe('number');
  });
});

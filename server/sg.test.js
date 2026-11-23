import { describe, it, expect } from 'vitest';
import { autoCategory, computeSG, shotSG } from './sg.js';
import { getExpectedStrokes } from './baseline.js';

describe('autoCategory', () => {
  it('tags the tee shot on a par 4/5 as OTT', () => {
    expect(autoCategory(1, 'TEE', 420, 4)).toBe('OTT');
    expect(autoCategory(1, 'TEE', 520, 5)).toBe('OTT');
  });

  it('tags a re-teed drive after OB as OTT, not APP', () => {
    // Drive OB (shot 1), penalty (shot 2), re-tee is shot 3.
    expect(autoCategory(3, 'TEE', 420, 4)).toBe('OTT');
    expect(autoCategory(3, 'TEE', 180, 3)).toBe('APP');
  });

  it('does not tag a par-3 tee shot as OTT, even when short', () => {
    expect(autoCategory(1, 'TEE', 25, 3)).toBe('APP');
  });

  it('tags a par-4/5 tee shot as OTT even past the ARG distance threshold check', () => {
    // Guards against the TEE lie ever leaking into ARG via the <=30yd rule.
    expect(autoCategory(1, 'TEE', 20, 4)).toBe('OTT');
  });

  it('tags any shot starting on the green as PUTT, regardless of distance', () => {
    expect(autoCategory(2, 'GREEN', 0.333, 4)).toBe('PUTT');
    expect(autoCategory(2, 'GREEN', 33, 4)).toBe('PUTT');
  });

  it('tags any shot starting on the fringe as PUTT too, matching GREEN', () => {
    expect(autoCategory(2, 'FRINGE', 0.333, 4)).toBe('PUTT');
    expect(autoCategory(2, 'FRINGE', 5, 4)).toBe('PUTT');
    expect(autoCategory(2, 'FRINGE', 33, 4)).toBe('PUTT');
  });

  it('tags a short non-tee, non-green/fringe shot as ARG', () => {
    expect(autoCategory(2, 'ROUGH', 30, 4)).toBe('ARG');
    expect(autoCategory(2, 'SAND', 10, 4)).toBe('ARG');
  });

  it('tags a long non-tee shot as APP', () => {
    expect(autoCategory(2, 'FAIRWAY', 150, 4)).toBe('APP');
  });

  it('never tags a shot from TEE as ARG, even within 30 yards', () => {
    expect(autoCategory(1, 'TEE', 10, 3)).not.toBe('ARG');
  });
});

describe('computeSG', () => {
  it('matches the definition: E(start) - E(end) - 1', () => {
    const distStart = 10, distEnd = 3, lieStart = 'FAIRWAY', lieEnd = 'GREEN';
    const expected =
      getExpectedStrokes(distStart, lieStart) - getExpectedStrokes(distEnd, lieEnd) - 1;
    expect(computeSG(distStart, lieStart, distEnd, lieEnd, false)).toBeCloseTo(expected, 4);
  });

  it('treats a holed shot as having 0 expected strokes remaining', () => {
    const sg = computeSG(1, 'GREEN', 999 /* should be ignored */, 'FAIRWAY', true);
    const expected = getExpectedStrokes(1, 'GREEN') - 0 - 1;
    expect(sg).toBeCloseTo(expected, 4);
  });

  it('gives a small positive SG for holing a routine short putt', () => {
    const sg = computeSG(0.667 /* 2 ft */, 'GREEN', 0, 'GREEN', true);
    expect(sg).toBeGreaterThan(0);
    expect(sg).toBeLessThan(0.1);
  });

  it('gives a large negative SG for missing a routine short putt', () => {
    const sg = computeSG(0.667 /* 2 ft */, 'GREEN', 0.333 /* 1 ft left */, 'GREEN', false);
    expect(sg).toBeLessThan(-0.5);
  });

  it('is sensitive to small differences in starting distance for short putts', () => {
    // Regression guard for the dist_start-rounding bug: a 2.4ft vs 2.0ft
    // starting distance on a made putt must not produce the same SG.
    const precise = computeSG(2.4 / 3, 'GREEN', 0, 'GREEN', true);
    const roundedDown = computeSG(2 / 3, 'GREEN', 0, 'GREEN', true);
    expect(precise).not.toBeCloseTo(roundedDown, 4);
  });

  it('telescopes across a multi-putt sequence: total SG equals expected(start) - actual strokes', () => {
    // 40ft putt -> leaves 3ft -> holed. Two strokes taken.
    const startDist = 40 / 3;
    const midDist = 3 / 3;
    const sg1 = computeSG(startDist, 'GREEN', midDist, 'GREEN', false);
    const sg2 = computeSG(midDist, 'GREEN', 0, 'GREEN', true);
    const totalSG = sg1 + sg2;
    const strokesTaken = 2;
    const expectedFromStart = getExpectedStrokes(startDist, 'GREEN');
    expect(totalSG).toBeCloseTo(expectedFromStart - strokesTaken, 4);
  });

  it('rounds to 4 decimal places', () => {
    const sg = computeSG(10, 'FAIRWAY', 3, 'GREEN', false);
    expect(sg).toBe(Number(sg.toFixed(4)));
  });

  it('charges an OB shot exactly 2 strokes (stroke and distance) and nothing more', () => {
    // Previously the OB end was valued as rough at the same distance and the
    // penalty row scored -1 separately, giving about -2.25 for a 400y drive.
    expect(computeSG(400, 'TEE', 400, 'OB', false)).toBeCloseTo(-2, 4);
    expect(computeSG(180, 'FAIRWAY', 180, 'OB', false)).toBeCloseTo(-2, 4);
  });

  it('charges a hazard shot its result plus one penalty stroke', () => {
    const sg = computeSG(150, 'FAIRWAY', 40, 'HAZARD', false);
    const expected = getExpectedStrokes(150, 'FAIRWAY') - getExpectedStrokes(40, 'ROUGH') - 2;
    expect(sg).toBeCloseTo(expected, 4);
  });
});

describe('shotSG', () => {
  it('scores PENALTY rows as 0 so the categories sum to the total', () => {
    expect(shotSG({ category: 'PENALTY', dist_start: 400, lie_start: 'TEE', dist_end: 400, lie_end: 'TEE', holed: 0 })).toBe(0);
  });

  it('telescopes an OB hole: total SG = E(tee) - strokes taken', () => {
    // Par 4, 400y: drive OB, penalty, re-tee to 150 fairway, approach to 20ft, 2 putts = 6.
    const shots = [
      { category: 'OTT', dist_start: 400, lie_start: 'TEE', dist_end: 400, lie_end: 'OB', holed: 0 },
      { category: 'PENALTY', dist_start: 400, lie_start: 'TEE', dist_end: 400, lie_end: 'TEE', holed: 0 },
      { category: 'OTT', dist_start: 400, lie_start: 'TEE', dist_end: 150, lie_end: 'FAIRWAY', holed: 0 },
      { category: 'APP', dist_start: 150, lie_start: 'FAIRWAY', dist_end: 20 / 3, lie_end: 'GREEN', holed: 0 },
      { category: 'PUTT', dist_start: 20 / 3, lie_start: 'GREEN', dist_end: 1, lie_end: 'GREEN', holed: 0 },
      { category: 'PUTT', dist_start: 1, lie_start: 'GREEN', dist_end: null, lie_end: null, holed: 1 },
    ];
    const total = shots.reduce((sum, s) => sum + shotSG(s), 0);
    expect(total).toBeCloseTo(getExpectedStrokes(400, 'TEE') - 6, 3);
  });

  it('telescopes a hazard hole: total SG = E(tee) - strokes taken', () => {
    // Par 4, 380y: drive to 150, approach into hazard at 40y, penalty, drop & pitch to 6ft, 1 putt = 5.
    const shots = [
      { category: 'OTT', dist_start: 380, lie_start: 'TEE', dist_end: 150, lie_end: 'FAIRWAY', holed: 0 },
      { category: 'APP', dist_start: 150, lie_start: 'FAIRWAY', dist_end: 40, lie_end: 'HAZARD', holed: 0 },
      { category: 'PENALTY', dist_start: 40, lie_start: 'ROUGH', dist_end: 40, lie_end: 'ROUGH', holed: 0 },
      { category: 'APP', dist_start: 40, lie_start: 'ROUGH', dist_end: 2, lie_end: 'GREEN', holed: 0 },
      { category: 'PUTT', dist_start: 2, lie_start: 'GREEN', dist_end: null, lie_end: null, holed: 1 },
    ];
    const total = shots.reduce((sum, s) => sum + shotSG(s), 0);
    expect(total).toBeCloseTo(getExpectedStrokes(380, 'TEE') - 5, 3);
  });
});

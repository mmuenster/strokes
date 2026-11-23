import { describe, it, expect } from 'vitest';
import { getExpectedStrokes, validateDistance } from './baseline.js';

describe('getExpectedStrokes', () => {
  it('returns 0 at the hole', () => {
    expect(getExpectedStrokes(0, 'GREEN')).toBe(0);
  });

  it('returns an exact table value at a known putting distance (3 ft = 1 yd)', () => {
    expect(getExpectedStrokes(1, 'GREEN')).toBeCloseTo(1.04, 3);
  });

  it('interpolates linearly between two known putting distances', () => {
    // 2 ft (0.667 yd) -> 1.01, 3 ft (1.000 yd) -> 1.04. Midpoint should be the average.
    const mid = (2 / 3 + 1.0) / 2;
    const expected = (1.01 + 1.04) / 2;
    expect(getExpectedStrokes(mid, 'GREEN')).toBeCloseTo(expected, 3);
  });

  it('clamps to the shortest putting distance below the table minimum', () => {
    expect(getExpectedStrokes(0.05, 'GREEN')).toBeCloseTo(1.00, 3);
  });

  it('clamps to the longest distance above the table maximum', () => {
    expect(getExpectedStrokes(9999, 'FAIRWAY')).toBeCloseTo(4.94, 2);
  });

  it('matches PGA Tour (Broadie) benchmark values for the scratch profile', () => {
    expect(getExpectedStrokes(400, 'TEE')).toBeCloseTo(3.99, 2);
    expect(getExpectedStrokes(160, 'TEE')).toBeCloseTo(2.99, 2);
    expect(getExpectedStrokes(100, 'FAIRWAY')).toBeCloseTo(2.80, 2);
    expect(getExpectedStrokes(300, 'FAIRWAY')).toBeCloseTo(3.78, 2);
    expect(getExpectedStrokes(100, 'ROUGH')).toBeCloseTo(3.02, 2);
    expect(getExpectedStrokes(20, 'SAND')).toBeCloseTo(2.53, 2);
    expect(getExpectedStrokes(20 / 3, 'GREEN')).toBeCloseTo(1.87, 2); // 20 ft
  });

  it('uses a dedicated tee curve rather than the fairway curve', () => {
    expect(getExpectedStrokes(400, 'TEE')).not.toBeCloseTo(getExpectedStrokes(400, 'FAIRWAY'), 2);
  });

  it('values short chips below the old 25-yard floor', () => {
    // Previously everything under 25y clamped to the 25y value, which made
    // short chips look harder than they are and inflated ARG SG.
    expect(getExpectedStrokes(10, 'FAIRWAY')).toBeLessThan(getExpectedStrokes(25, 'FAIRWAY'));
    expect(getExpectedStrokes(10, 'ROUGH')).toBeLessThan(getExpectedStrokes(25, 'ROUGH'));
    expect(getExpectedStrokes(10, 'FAIRWAY')).toBeCloseTo(2.18, 2);
  });

  it('treats FRINGE the same as GREEN (putting curve)', () => {
    expect(getExpectedStrokes(1, 'FRINGE')).toBe(getExpectedStrokes(1, 'GREEN'));
  });

  it('treats OB and HAZARD as rough', () => {
    expect(getExpectedStrokes(100, 'OB')).toBe(getExpectedStrokes(100, 'ROUGH'));
    expect(getExpectedStrokes(100, 'HAZARD')).toBe(getExpectedStrokes(100, 'ROUGH'));
  });

  it('falls back to the fairway curve for an unrecognized lie', () => {
    expect(getExpectedStrokes(100, 'NONSENSE')).toBe(getExpectedStrokes(100, 'FAIRWAY'));
  });

  it('falls back to the scratch profile for an unrecognized profile', () => {
    expect(getExpectedStrokes(100, 'FAIRWAY', 'nonsense')).toBe(
      getExpectedStrokes(100, 'FAIRWAY', 'scratch')
    );
  });

  it('a higher handicap profile always expects more strokes than scratch', () => {
    for (const lie of ['GREEN', 'TEE', 'FAIRWAY', 'ROUGH', 'SAND', 'RECOVERY']) {
      for (const dist of [1, 5, 10, 25, 50, 100, 150, 250, 400, 550, 700]) {
        // The tee curve starts at 100y — no real hole is shorter.
        if (lie === 'TEE' && dist < 100) continue;
        expect(getExpectedStrokes(dist, lie, 'hdcp15')).toBeGreaterThanOrEqual(
          getExpectedStrokes(dist, lie, 'scratch')
        );
      }
    }
  });

  it('expected strokes never decrease as distance increases, on every curve', () => {
    for (const lie of ['GREEN', 'FAIRWAY', 'ROUGH', 'SAND', 'RECOVERY']) {
      const samples = [1, 5, 10, 25, 50, 100, 200, 400];
      const values = samples.map((d) => getExpectedStrokes(d, lie));
      for (let i = 1; i < values.length; i++) {
        expect(values[i]).toBeGreaterThanOrEqual(values[i - 1]);
      }
    }
  });
});

describe('validateDistance', () => {
  it('accepts in-range numbers', () => {
    expect(validateDistance(0)).toBe(true);
    expect(validateDistance(1000)).toBe(true);
    expect(validateDistance(150.5)).toBe(true);
  });

  it('rejects negative numbers, out-of-range numbers, and non-numbers', () => {
    expect(validateDistance(-1)).toBe(false);
    expect(validateDistance(1000.01)).toBe(false);
    expect(validateDistance(NaN)).toBe(false);
    expect(validateDistance(Infinity)).toBe(false);
    expect(validateDistance('150')).toBe(false);
    expect(validateDistance(null)).toBe(false);
    expect(validateDistance(undefined)).toBe(false);
  });
});

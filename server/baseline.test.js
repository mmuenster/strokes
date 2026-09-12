import { describe, it, expect } from 'vitest';
import { getExpectedStrokes, validateDistance } from './baseline.js';

describe('getExpectedStrokes', () => {
  it('returns 0 at the hole', () => {
    expect(getExpectedStrokes(0, 'GREEN')).toBe(0);
  });

  it('returns an exact table value at a known putting distance (3 ft = 1 yd)', () => {
    expect(getExpectedStrokes(1, 'GREEN')).toBeCloseTo(1.083, 3);
  });

  it('interpolates linearly between two known putting distances', () => {
    // 2 ft (0.667 yd) -> 1.010, 3 ft (1.000 yd) -> 1.083. Midpoint should be the average.
    const mid = (0.667 + 1.0) / 2;
    const expected = (1.010 + 1.083) / 2;
    expect(getExpectedStrokes(mid, 'GREEN')).toBeCloseTo(expected, 2);
  });

  it('clamps to the shortest putting distance below the table minimum', () => {
    expect(getExpectedStrokes(0.05, 'GREEN')).toBeCloseTo(1.001, 3);
  });

  it('clamps to the longest distance above the table maximum', () => {
    expect(getExpectedStrokes(9999, 'FAIRWAY')).toBeCloseTo(4.68, 2);
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
    for (const lie of ['GREEN', 'FAIRWAY', 'ROUGH', 'SAND']) {
      for (const dist of [5, 50, 150]) {
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

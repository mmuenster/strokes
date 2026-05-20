// Strokes-to-hole-out baseline tables.
// All distances stored in yards. Putts are converted feet→yards before lookup.
// Scratch baseline: Mark Broadie / PGA Tour ShotLink averages.
// Hdcp15 baseline: approximate values for a ~15-handicap golfer.

function interpolate(curve, x) {
  if (x <= curve[0][0]) return curve[0][1];
  if (x >= curve[curve.length - 1][0]) return curve[curve.length - 1][1];
  for (let i = 0; i < curve.length - 1; i++) {
    const [x0, y0] = curve[i];
    const [x1, y1] = curve[i + 1];
    if (x >= x0 && x <= x1) {
      const t = (x - x0) / (x1 - x0);
      return y0 + t * (y1 - y0);
    }
  }
  return curve[curve.length - 1][1];
}

const BASELINE = {
  scratch: {
    // Putting: yards from hole → expected putts
    putting: [
      [0.028, 1.001], // 1 ft
      [0.056, 1.010], // 2 ft
      [0.083, 1.083], // 3 ft
      [0.111, 1.175], // 4 ft
      [0.139, 1.265], // 5 ft
      [0.167, 1.350], // 6 ft
      [0.222, 1.499], // 8 ft
      [0.278, 1.619], // 10 ft
      [0.417, 1.826], // 15 ft
      [0.556, 1.946], // 20 ft
      [0.694, 2.017], // 25 ft
      [0.833, 2.062], // 30 ft
      [1.111, 2.127], // 40 ft
      [1.667, 2.213], // 60 ft
      [2.222, 2.272], // 80 ft
      [2.778, 2.317], // 100 ft
    ],
    // Full shots: yards from hole → expected strokes
    fairway: [
      [25, 2.40], [50, 2.60], [75, 2.72], [100, 2.83],
      [125, 2.93], [150, 3.02], [175, 3.10], [200, 3.18],
      [225, 3.26], [250, 3.35], [275, 3.44], [300, 3.54],
      [350, 3.73], [400, 3.93], [450, 4.12], [500, 4.32],
      [550, 4.50], [600, 4.68],
    ],
    rough: [
      [25, 2.55], [50, 2.72], [75, 2.87], [100, 2.98],
      [125, 3.08], [150, 3.17], [175, 3.26], [200, 3.36],
      [225, 3.46], [250, 3.57], [275, 3.67], [300, 3.78],
      [350, 3.98], [400, 4.18], [450, 4.38], [500, 4.55],
    ],
    sand: [
      [0.5, 2.20], [1, 2.40], [5, 2.55], [10, 2.65],
      [25, 2.78], [50, 2.92], [75, 3.05], [100, 3.18],
      [125, 3.32], [150, 3.45], [175, 3.58], [200, 3.72],
    ],
    recovery: [
      [5, 2.80], [10, 2.95], [25, 3.10], [50, 3.30],
      [100, 3.60], [150, 3.85], [200, 4.10], [250, 4.35], [300, 4.58],
    ],
  },

  hdcp15: {
    putting: [
      [0.028, 1.002], // 1 ft
      [0.056, 1.015], // 2 ft
      [0.083, 1.100], // 3 ft
      [0.111, 1.220], // 4 ft
      [0.139, 1.340], // 5 ft
      [0.167, 1.455], // 6 ft
      [0.222, 1.620], // 8 ft
      [0.278, 1.760], // 10 ft
      [0.417, 1.980], // 15 ft
      [0.556, 2.140], // 20 ft
      [0.694, 2.240], // 25 ft
      [0.833, 2.310], // 30 ft
      [1.111, 2.400], // 40 ft
      [1.667, 2.490], // 60 ft
      [2.222, 2.560], // 80 ft
      [2.778, 2.620], // 100 ft
    ],
    fairway: [
      [25, 2.70], [50, 2.95], [75, 3.12], [100, 3.28],
      [125, 3.42], [150, 3.55], [175, 3.67], [200, 3.80],
      [225, 3.92], [250, 4.05], [275, 4.18], [300, 4.30],
      [350, 4.55], [400, 4.80], [450, 5.05], [500, 5.28], [550, 5.50],
    ],
    rough: [
      [25, 2.90], [50, 3.10], [75, 3.28], [100, 3.43],
      [125, 3.57], [150, 3.70], [175, 3.83], [200, 3.96],
      [225, 4.10], [250, 4.24], [275, 4.37], [300, 4.50],
      [350, 4.75], [400, 5.00], [450, 5.25],
    ],
    sand: [
      [0.5, 2.50], [1, 2.70], [5, 2.85], [10, 2.98],
      [25, 3.12], [50, 3.28], [75, 3.43], [100, 3.58],
      [125, 3.73], [150, 3.88], [175, 4.02],
    ],
    recovery: [
      [5, 3.10], [10, 3.25], [25, 3.40], [50, 3.65],
      [100, 3.95], [150, 4.25], [200, 4.52], [250, 4.78],
    ],
  },
};

// lie values: TEE, FAIRWAY, ROUGH, SAND, RECOVERY, GREEN, FRINGE
function getCurve(profile, lie) {
  const p = BASELINE[profile] ?? BASELINE.scratch;
  if (lie === 'GREEN' || lie === 'FRINGE') return p.putting;
  const key = lie.toLowerCase();
  return p[key] ?? p.fairway;
}

export function getExpectedStrokes(distYards, lie, profile = 'scratch') {
  if (distYards <= 0) return 0;
  const curve = getCurve(profile, lie);
  return interpolate(curve, distYards);
}

export function validateDistance(distYards) {
  return typeof distYards === 'number' && isFinite(distYards) && distYards >= 0 && distYards <= 1000;
}

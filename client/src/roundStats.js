// Shared stat computation and UI helpers for round summary views

export function pct(made, attempted) {
  if (!attempted) return '—';
  return `${Math.round((made / attempted) * 100)}%`;
}

export function fmtScore(n) {
  if (n === 0) return 'E';
  return n > 0 ? `+${n}` : `${n}`;
}

export function avg(arr) {
  if (!arr.length) return null;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

export function computeStats(round) {
  const holes = (round.holes ?? []).filter(h => (h.shots ?? []).length > 0);
  if (!holes.length) return null;

  const allShots = holes.flatMap(h => h.shots);

  const holeStats = holes.map(hole => {
    const shots = hole.shots;
    const score = shots.length;
    const par = hole.par;
    const scoreToPar = score - par;

    const shot1 = shots.find(s => s.sequence === 1);
    const firstOnGreen = shots.find(s => s.lie_end === 'GREEN' || s.lie_end === 'FRINGE');
    const gir = firstOnGreen ? firstOnGreen.sequence <= par - 2 : false;

    const puttCount = shots.filter(s => s.category === 'PUTT').length;
    const fairwayAttempted = par >= 4;
    const fairwayHit = fairwayAttempted && shot1?.lie_end === 'FAIRWAY';
    const driveDistance = fairwayAttempted && shot1?.dist_end != null
      ? shot1.dist_start - shot1.dist_end : null;

    const hasSandShot = shots.some(s => s.lie_start === 'SAND');

    return {
      par, score, scoreToPar, puttCount, gir,
      fairwayAttempted, fairwayHit, driveDistance, hasSandShot,
    };
  });

  const n = holeStats.length;
  const totalStrokes = holeStats.reduce((s, h) => s + h.score, 0);
  const totalPar = holeStats.reduce((s, h) => s + h.par, 0);

  const eagles      = holeStats.filter(h => h.scoreToPar <= -2).length;
  const birdies     = holeStats.filter(h => h.scoreToPar === -1).length;
  const pars        = holeStats.filter(h => h.scoreToPar === 0).length;
  const bogeys      = holeStats.filter(h => h.scoreToPar === 1).length;
  const doubles     = holeStats.filter(h => h.scoreToPar === 2).length;
  const triplePlus  = holeStats.filter(h => h.scoreToPar >= 3).length;

  const drivingHoles = holeStats.filter(h => h.fairwayAttempted);
  const fairwaysHit = drivingHoles.filter(h => h.fairwayHit).length;
  const driveDists = drivingHoles.map(h => h.driveDistance).filter(d => d != null && d > 0);
  const avgDriveDistance = driveDists.length ? Math.round(avg(driveDists)) : null;

  const girHit = holeStats.filter(h => h.gir).length;

  const totalPutts = holeStats.reduce((s, h) => s + h.puttCount, 0);
  const girHoles = holeStats.filter(h => h.gir);
  const avgPuttsGIR = girHoles.length
    ? (girHoles.reduce((s, h) => s + h.puttCount, 0) / girHoles.length).toFixed(2) : null;
  const onePutts       = holeStats.filter(h => h.puttCount === 1).length;
  const twoPutts       = holeStats.filter(h => h.puttCount === 2).length;
  const threePlusPutts = holeStats.filter(h => h.puttCount >= 3).length;
  const totalFeetHoled = Math.round(
    allShots.filter(s => s.category === 'PUTT' && s.holed).reduce((sum, s) => sum + s.dist_start * 3, 0)
  );

  const appShots = allShots.filter(s => s.category === 'APP');
  const appOnGreen = appShots.filter(s => s.lie_end === 'GREEN' || s.lie_end === 'FRINGE');
  const avgApproachDist = appShots.length ? Math.round(avg(appShots.map(s => s.dist_start))) : null;
  const avgProximityFt = appOnGreen.length
    ? Math.round(avg(appOnGreen.map(s => s.dist_end * 3))) : null;

  const scramblingAttempted = holeStats.filter(h => !h.gir).length;
  const scramblingMade = holeStats.filter(h => !h.gir && h.scoreToPar <= 0).length;

  const sandAttempted = holeStats.filter(h => h.hasSandShot).length;
  const sandMade = holeStats.filter(h => h.hasSandShot && h.scoreToPar <= 0).length;

  const sandShots = allShots.filter(s => s.lie_start === 'SAND');
  const greensideSand = sandShots.filter(s => s.category === 'ARG' || s.dist_start <= 30);
  const fairwayBunker = sandShots.filter(s => s.category !== 'ARG' && s.dist_start > 30);
  const holedFromSand = sandShots.filter(s => s.holed).length;
  const avgSandDist = sandShots.length ? Math.round(avg(sandShots.map(s => s.dist_start))) : null;
  const sandOnGreen = sandShots.filter(s => (s.lie_end === 'GREEN' || s.lie_end === 'FRINGE') && !s.holed);
  const avgSandProximityFt = sandOnGreen.length
    ? Math.round(avg(sandOnGreen.map(s => s.dist_end * 3))) : null;
  const avgSandDistGained = sandShots.filter(s => !s.holed && s.dist_end != null).length
    ? Math.round(avg(sandShots.filter(s => !s.holed && s.dist_end != null).map(s => s.dist_start - s.dist_end))) : null;
  const totalSandSG = sandShots.reduce((sum, s) => sum + Number(s.sg), 0);
  const avgSandSG = sandShots.length ? totalSandSG / sandShots.length : null;
  const sandOutcomes = sandShots.reduce((acc, s) => {
    const key = s.holed ? 'Holed' : (s.lie_end ?? 'Unknown');
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

  const obShots        = allShots.filter(s => s.lie_end === 'OB').length;
  const hazardShots    = allShots.filter(s => s.lie_end === 'HAZARD').length;
  const penaltyStrokes = allShots.filter(s => s.category === 'PENALTY').length;

  const sg = round.sg ?? {};

  return {
    n, totalStrokes, totalPar,
    scoreToPar: totalStrokes - totalPar,
    scoring: { eagles, birdies, pars, bogeys, doubles, triplePlus },
    driving: { fairwaysHit, fairwaysAttempted: drivingHoles.length, avgDriveDistance },
    gir: { hit: girHit, attempted: n },
    putting: { totalPutts, avgPerHole: (totalPutts / n).toFixed(2), avgPuttsGIR, onePutts, twoPutts, threePlusPutts, totalFeetHoled },
    approach: { avgDist: avgApproachDist, avgProximityFt, count: appShots.length },
    scrambling: { made: scramblingMade, attempted: scramblingAttempted },
    sand: { made: sandMade, attempted: sandAttempted },
    sandDetail: {
      total: sandShots.length, greenside: greensideSand.length, fairwayBunker: fairwayBunker.length,
      holedFromSand, avgDist: avgSandDist, avgProximityFt: avgSandProximityFt,
      avgDistGained: avgSandDistGained, avgSG: avgSandSG, totalSG: totalSandSG, outcomes: sandOutcomes,
    },
    penalties: { ob: obShots, hazard: hazardShots, total: penaltyStrokes },
    sg,
  };
}

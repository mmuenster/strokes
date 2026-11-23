import { getExpectedStrokes } from './baseline.js';

// Lies that cost a one-stroke penalty when a shot ends there.
export const PENALTY_LIES = ['OB', 'HAZARD'];

// Priority: OTT → PUTT → ARG → APP
// Any shot from the tee on a par 4/5 is OTT — including a re-teed drive
// after going OB, which is shot 3 rather than shot 1.
// FRINGE is treated identically to GREEN throughout (see getCurve in
// baseline.js and isPuttLie in client/src/utils.js) — a shot from the
// fringe is scored against the putting baseline, entered/displayed in
// feet, and categorized as a putt, the same as one from the green.
export function autoCategory(sequenceNum, lieStart, distStartYards, holePar) {
  if (lieStart === 'TEE' && holePar >= 4) return 'OTT';
  if (lieStart === 'GREEN' || lieStart === 'FRINGE') return 'PUTT';
  if (distStartYards <= 30 && lieStart !== 'TEE') return 'ARG';
  return 'APP';
}

// Strokes gained for one shot: E(start) − E(next start) − strokes used.
//
// Penalties are charged to the shot that caused them (as Golfmetrics /
// Broadie do), so a shot ending OB or in a hazard uses 2 strokes — the swing
// plus the penalty — and the separate PENALTY row scores 0. That keeps the
// OTT/APP/ARG/PUTT categories summing to the total.
//   OB:     stroke and distance — the next shot is played from the same spot
//           and lie, so E(next start) = E(start).
//   HAZARD: next shot is a drop, valued as rough at the ending distance.
export function computeSG(distStart, lieStart, distEnd, lieEnd, holed, profile = 'scratch') {
  const expectedStart = getExpectedStrokes(distStart, lieStart, profile);
  let expectedEnd;
  if (holed) expectedEnd = 0;
  else if (lieEnd === 'OB') expectedEnd = expectedStart;
  else expectedEnd = getExpectedStrokes(distEnd, lieEnd, profile);
  const strokes = !holed && PENALTY_LIES.includes(lieEnd) ? 2 : 1;
  return parseFloat((expectedStart - expectedEnd - strokes).toFixed(4));
}

// SG for a stored shot row. PENALTY rows count toward the score but carry
// no SG of their own — the penalty is already in the offending shot's SG.
export function shotSG(shot, profile = 'scratch') {
  if (shot.category === 'PENALTY') return 0;
  const holed = Boolean(shot.holed);
  return computeSG(
    Number(shot.dist_start), shot.lie_start,
    holed ? 0 : Number(shot.dist_end), holed ? 'GREEN' : shot.lie_end,
    holed, profile
  );
}

import { getExpectedStrokes } from './baseline.js';

// Priority: OTT → PUTT → ARG → APP
// FRINGE is treated identically to GREEN throughout (see getCurve in
// baseline.js and isPuttLie in client/src/utils.js) — a shot from the
// fringe is scored against the putting baseline, entered/displayed in
// feet, and categorized as a putt, the same as one from the green.
export function autoCategory(sequenceNum, lieStart, distStartYards, holePar) {
  if (sequenceNum === 1 && lieStart === 'TEE' && holePar >= 4) return 'OTT';
  if (lieStart === 'GREEN' || lieStart === 'FRINGE') return 'PUTT';
  if (distStartYards <= 30 && lieStart !== 'TEE') return 'ARG';
  return 'APP';
}

export function computeSG(distStart, lieStart, distEnd, lieEnd, holed, profile = 'scratch') {
  const expectedStart = getExpectedStrokes(distStart, lieStart, profile);
  const expectedEnd = holed ? 0 : getExpectedStrokes(distEnd, lieEnd, profile);
  return parseFloat((expectedStart - expectedEnd - 1).toFixed(4));
}

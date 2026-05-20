export function fmtSG(val) {
  if (val == null) return '—';
  const n = Number(val);
  return (n >= 0 ? '+' : '') + n.toFixed(2);
}

export function sgClass(val) {
  const n = Number(val);
  if (n > 0.05) return 'sg-positive';
  if (n < -0.05) return 'sg-negative';
  return 'sg-neutral';
}

// Convert a putt distance input (in feet) to yards for the API
export function feetToYards(feet) {
  return Number(feet) / 3;
}

// Convert yards back to feet for display
export function yardsToFeet(yards) {
  return Math.round(Number(yards) * 3);
}

export function isPuttLie(lie) {
  return lie === 'GREEN' || lie === 'FRINGE';
}

// Format distance for display given lie
export function fmtDist(yards, lie) {
  if (!yards && yards !== 0) return '—';
  if (isPuttLie(lie)) {
    return `${yardsToFeet(yards)} ft`;
  }
  return `${Math.round(yards)} yd`;
}

export const LIES = ['TEE', 'FAIRWAY', 'ROUGH', 'SAND', 'RECOVERY', 'FRINGE', 'GREEN'];
export const LIE_LABELS = {
  TEE: 'Tee',
  FAIRWAY: 'Fairway',
  ROUGH: 'Rough',
  SAND: 'Sand',
  RECOVERY: 'Recovery',
  FRINGE: 'Fringe',
  GREEN: 'Green',
};

export const CAT_LABELS = { OTT: 'Off the Tee', APP: 'Approach', ARG: 'Around Green', PUTT: 'Putting' };
export const CAT_COLORS = {
  OTT:  { bg: 'bg-blue-100',   text: 'text-blue-700',   bar: '#3b82f6' },
  APP:  { bg: 'bg-purple-100', text: 'text-purple-700', bar: '#a855f7' },
  ARG:  { bg: 'bg-orange-100', text: 'text-orange-700', bar: '#f97316' },
  PUTT: { bg: 'bg-teal-100',   text: 'text-teal-700',   bar: '#14b8a6' },
};

import { useState, useEffect } from 'react';
import { api } from '../api.js';
import { END_LIES, LIE_LABELS, CAT_LABELS, CAT_COLORS, isPuttLie, feetToYards, fmtDist } from '../utils.js';

function autoCategory(sequence, lieStart, distYards, holePar) {
  if (sequence === 1 && lieStart === 'TEE' && holePar >= 4) return 'OTT';
  if (lieStart === 'GREEN') return 'PUTT';
  if (distYards <= 30 && lieStart !== 'TEE') return 'ARG';
  return 'APP';
}

function defaultEndLie(previousShot) {
  if (!previousShot) return 'FAIRWAY';
  if (previousShot.lie_end === 'GREEN') return 'GREEN';
  return 'FAIRWAY';
}

export default function ShotForm({ hole, previousShot, onSaved }) {
  const nextSeq = previousShot ? previousShot.sequence + 1 : 1;

  const [lieStart] = useState('TEE');
  const [distStartRaw, setDistStartRaw] = useState(() =>
    !previousShot && hole.yardage ? String(hole.yardage) : ''
  );

  // 'HOLED' is a UI-only pseudo-lie that means the shot was holed out
  const [lieEnd, setLieEnd] = useState(() => defaultEndLie(previousShot));
  const [distEndRaw, setDistEndRaw] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [lastSaved, setLastSaved] = useState(null);

  const isHoled = lieEnd === 'HOLED';

  // Reset all fields when switching holes
  useEffect(() => {
    setDistStartRaw(!previousShot && hole.yardage ? String(hole.yardage) : '');
    setDistEndRaw('');
    setLieEnd(defaultEndLie(previousShot));
    setError(null);
    setLastSaved(null);
  }, [hole.id]);

  // Reset result fields when a new shot is ready on the same hole
  useEffect(() => {
    setDistEndRaw('');
    setLieEnd(defaultEndLie(previousShot));
    setError(null);
    setLastSaved(null);
  }, [previousShot?.id]);

  const effectiveLieStart = previousShot ? previousShot.lie_end : lieStart;
  const effectiveDistStartYards = previousShot
    ? previousShot.dist_end
    : isPuttLie(lieStart) ? feetToYards(distStartRaw) : Number(distStartRaw);

  const hasStart = previousShot ? true : Boolean(distStartRaw);
  // OB: no distance needed — you replay from the original spot
  const needsDist = !isHoled && lieEnd !== 'OB';
  const distEndYards = isPuttLie(lieEnd) ? feetToYards(distEndRaw) : Number(distEndRaw);

  const previewCat = hasStart
    ? autoCategory(nextSeq, effectiveLieStart, effectiveDistStartYards, hole.par)
    : null;

  async function save() {
    if (!hasStart) return setError('Enter starting distance.');
    if (needsDist && !distEndRaw) return setError('Enter ending distance.');
    setSaving(true);
    setError(null);
    try {
      const payload = {
        dist_start: effectiveDistStartYards,
        lie_start: effectiveLieStart,
        holed: isHoled ? 1 : 0,
        // OB: store dist_end = dist_start (no progress on the shot itself)
        dist_end: isHoled ? null : lieEnd === 'OB' ? effectiveDistStartYards : distEndYards,
        lie_end: isHoled ? null : lieEnd,
      };
      const shot = await api.shots.create(hole.id, payload);

      const isPenalty = lieEnd === 'OB' || lieEnd === 'HAZARD';
      if (isPenalty) {
        // OB: stroke + distance — replay from original position
        // HAZARD: 1 stroke penalty — drop near point of entry
        const penaltyStart = lieEnd === 'OB'
          ? { dist: effectiveDistStartYards, lie: effectiveLieStart }
          : { dist: distEndYards, lie: 'ROUGH' };
        const penalty = await api.shots.create(hole.id, {
          dist_start: penaltyStart.dist,
          lie_start: penaltyStart.lie,
          dist_end: penaltyStart.dist,
          lie_end: penaltyStart.lie,
          holed: 0,
          category: 'PENALTY',
        });
        setLastSaved(penalty);
        onSaved(shot);
        onSaved(penalty);
      } else {
        setLastSaved(shot);
        onSaved(shot);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (previousShot?.holed) {
    return (
      <p className="text-center text-gray-400 py-4 text-sm">
        Hole complete — all shots holed.
      </p>
    );
  }

  const catColors = previewCat ? CAT_COLORS[previewCat] : null;

  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-gray-600">Shot {nextSeq}</span>
        {previewCat && catColors && (
          <span className={`text-xs font-semibold px-2 py-1 rounded-full ${catColors.bg} ${catColors.text}`}>
            {CAT_LABELS[previewCat]}
          </span>
        )}
      </div>

      {/* Starting position */}
      {previousShot ? (
        <div className="rounded-xl bg-gray-50 px-3 py-2.5 text-sm">
          <span className="text-gray-400 text-xs block mb-0.5">Starting from</span>
          <span className="font-medium text-gray-800">
            {fmtDist(previousShot.dist_end, previousShot.lie_end)} · {LIE_LABELS[previousShot.lie_end]}
          </span>
        </div>
      ) : (
        <>
          <div>
            <label className="label">Starting distance (yards)</label>
            <input
              type="number"
              inputMode="decimal"
              className="input text-lg font-semibold"
              placeholder="e.g. 430"
              value={distStartRaw}
              onChange={(e) => setDistStartRaw(e.target.value)}
              autoFocus
            />
          </div>
          <div className="rounded-xl bg-gray-50 px-3 py-2.5 text-sm">
            <span className="text-gray-400 text-xs block mb-0.5">Starting lie</span>
            <span className="font-medium text-gray-700">Tee</span>
          </div>
        </>
      )}

      {/* Ending lie — location first, distance second */}
      <div>
        <label className="label">Ending location</label>
        <div className="grid grid-cols-3 gap-1.5">
          {END_LIES.map((lie) => (
            <button
              key={lie}
              type="button"
              onClick={() => setLieEnd(lie)}
              className={`py-2.5 px-1 rounded-xl text-xs font-semibold transition-colors ${
                lieEnd === lie
                  ? 'bg-gray-700 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {LIE_LABELS[lie]}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setLieEnd('HOLED')}
            className={`py-2.5 px-1 rounded-xl text-xs font-semibold transition-colors ${
              isHoled
                ? 'bg-green-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            ⛳ Holed
          </button>
        </div>
      </div>

      {/* Ending distance — hidden for holed shots and OB (replays from original spot) */}
      {needsDist && (
        <div>
          <label className="label">
            Ending distance {isPuttLie(lieEnd) ? '(feet)' : '(yards)'}
          </label>
          <input
            type="number"
            inputMode="decimal"
            className="input text-lg font-semibold"
            placeholder={isPuttLie(lieEnd) ? 'e.g. 8' : 'e.g. 15'}
            value={distEndRaw}
            onChange={(e) => setDistEndRaw(e.target.value)}
          />
        </div>
      )}

      {error && <p className="text-red-600 text-sm">{error}</p>}

      {lastSaved && (
        <div className="rounded-xl bg-gray-50 border border-gray-100 px-4 py-2 text-sm text-center">
          Shot {lastSaved.sequence} saved —{' '}
          <span className={lastSaved.sg >= 0 ? 'text-green-600 font-bold' : 'text-red-500 font-bold'}>
            {lastSaved.sg >= 0 ? '+' : ''}{Number(lastSaved.sg).toFixed(2)} SG
          </span>
        </div>
      )}

      <button
        type="button"
        onClick={save}
        disabled={!hasStart || (needsDist && !distEndRaw) || saving}
        className="btn-primary w-full text-base"
      >
        {saving ? 'Saving…' : 'Save shot'}
      </button>
    </div>
  );
}

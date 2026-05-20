import { useState, useEffect, useRef } from 'react';
import { api } from '../api.js';
import { LIES, LIE_LABELS, CAT_LABELS, CAT_COLORS, isPuttLie, feetToYards, fmtDist } from '../utils.js';

function autoCategory(sequence, lieStart, distYards, holePar) {
  if (sequence === 1 && lieStart === 'TEE' && holePar >= 4) return 'OTT';
  if (lieStart === 'GREEN') return 'PUTT';
  if (distYards <= 30 && lieStart !== 'TEE') return 'ARG';
  return 'APP';
}

export default function ShotForm({ hole, previousShot, onSaved }) {
  const nextSeq = previousShot ? previousShot.sequence + 1 : 1;

  // Start position — shot 1 is always TEE; subsequent shots locked to previous shot's end
  const [lieStart] = useState('TEE');
  const [distStartRaw, setDistStartRaw] = useState('');

  // Result
  const [lieEnd, setLieEnd] = useState('FAIRWAY');
  const [distEndRaw, setDistEndRaw] = useState('');
  const [holed, setHoled] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [lastSaved, setLastSaved] = useState(null);

  // Reset result fields when previousShot changes (new shot ready to enter)
  useEffect(() => {
    setDistEndRaw('');
    setLieEnd('FAIRWAY');
    setHoled(false);
    setError(null);
    setLastSaved(null);
  }, [previousShot?.id]);

  // Clear ending distance when switching between putt (feet) and non-putt (yards)
  const prevIsPuttEnd = useRef(false);
  useEffect(() => {
    const now = isPuttLie(lieEnd);
    if (now !== prevIsPuttEnd.current) {
      setDistEndRaw('');
      prevIsPuttEnd.current = now;
    }
  }, [lieEnd]);

  // Effective start — always from previous shot's end if it exists
  const effectiveLieStart = previousShot ? previousShot.lie_end : lieStart;
  const effectiveDistStartYards = previousShot
    ? previousShot.dist_end
    : isPuttLie(lieStart) ? feetToYards(distStartRaw) : Number(distStartRaw);

  const hasStart = previousShot ? true : Boolean(distStartRaw);
  const isPutt = isPuttLie(effectiveLieStart ?? '');
  const distEndYards = isPuttLie(lieEnd) ? feetToYards(distEndRaw) : Number(distEndRaw);

  const previewCat = hasStart
    ? autoCategory(nextSeq, effectiveLieStart, effectiveDistStartYards, hole.par)
    : null;

  async function save(isHoled) {
    if (!hasStart) return setError('Enter starting distance.');
    if (!isHoled && !distEndRaw) return setError('Enter ending distance.');
    setSaving(true);
    setError(null);
    try {
      const payload = {
        dist_start: effectiveDistStartYards,
        lie_start: effectiveLieStart,
        holed: isHoled ? 1 : 0,
        dist_end: isHoled ? null : distEndYards,
        lie_end: isHoled ? null : lieEnd,
      };
      const shot = await api.shots.create(hole.id, payload);
      setLastSaved(shot);
      onSaved(shot);
      // Result fields reset via useEffect when previousShot id changes
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
        // Locked — derived from previous shot's end
        <div className="rounded-xl bg-gray-50 px-3 py-2.5 text-sm">
          <span className="text-gray-400 text-xs block mb-0.5">Starting from</span>
          <span className="font-medium text-gray-800">
            {fmtDist(previousShot.dist_end, previousShot.lie_end)} · {LIE_LABELS[previousShot.lie_end]}
          </span>
        </div>
      ) : (
        // First shot — editable
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

      {/* Holed shortcut */}
      <button
        type="button"
        onClick={() => save(true)}
        disabled={!hasStart || saving}
        className="w-full py-4 rounded-2xl bg-green-500 hover:bg-green-600 text-white font-bold text-lg transition-colors disabled:opacity-50"
      >
        ⛳ Holed it!
      </button>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-200" />
        </div>
        <div className="relative flex justify-center">
          <span className="bg-white px-3 text-xs text-gray-400">or enter result</span>
        </div>
      </div>

      {/* Result */}
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

      <div>
        <label className="label">Ending lie</label>
        <div className="grid grid-cols-4 gap-1.5">
          {LIES.map((lie) => (
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
        </div>
      </div>

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
        onClick={() => save(false)}
        disabled={!hasStart || !distEndRaw || saving}
        className="btn-primary w-full text-base"
      >
        {saving ? 'Saving…' : 'Save shot'}
      </button>
    </div>
  );
}

import { useState, useEffect, useRef } from 'react';
import { api } from '../api.js';
import { LIES, LIE_LABELS, CAT_LABELS, CAT_COLORS, isPuttLie, feetToYards, fmtDist } from '../utils.js';

function autoCategory(sequence, lieStart, distYards, holePar) {
  if (sequence === 1 && lieStart === 'TEE' && holePar >= 4) return 'OTT';
  if (lieStart === 'GREEN') return 'PUTT';
  if (distYards <= 30 && lieStart !== 'TEE') return 'ARG';
  return 'APP';
}

export default function ShotEditForm({ shot, hole, isFirstShot, onSaved, onCancel }) {
  // Start is editable only for shot 1; all others are locked to previous shot's end
  // Shot 1 is always TEE; lock regardless of what's stored
  const [lieStart] = useState(isFirstShot ? 'TEE' : shot.lie_start);
  const [distStartRaw, setDistStartRaw] = useState(
    isPuttLie(shot.lie_start)
      ? String(Math.round(shot.dist_start * 3))
      : String(Math.round(shot.dist_start))
  );

  const [holed, setHoled] = useState(Boolean(shot.holed));
  const [lieEnd, setLieEnd] = useState(shot.lie_end ?? 'FAIRWAY');
  const [distEndRaw, setDistEndRaw] = useState(
    shot.dist_end != null
      ? isPuttLie(shot.lie_end ?? '')
        ? String(Math.round(shot.dist_end * 3))
        : String(Math.round(shot.dist_end))
      : ''
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Clear ending distance when switching between putt (feet) and non-putt (yards)
  const prevIsPuttEnd = useRef(isPuttLie(shot.lie_end ?? ''));
  useEffect(() => {
    const now = isPuttLie(lieEnd);
    if (now !== prevIsPuttEnd.current) {
      setDistEndRaw('');
      prevIsPuttEnd.current = now;
    }
  }, [lieEnd]);

  const distStartYards = isPuttLie(lieStart) ? feetToYards(distStartRaw) : Number(distStartRaw);
  const distEndYards = isPuttLie(lieEnd) ? feetToYards(distEndRaw) : Number(distEndRaw);
  const previewCat = autoCategory(shot.sequence, lieStart, distStartYards, hole.par);
  const catColors = CAT_COLORS[previewCat];

  async function save() {
    if (isFirstShot && !distStartRaw) return setError('Enter starting distance.');
    if (!holed && !distEndRaw) return setError('Enter ending distance.');
    setSaving(true);
    setError(null);
    try {
      const payload = {
        dist_start: distStartYards,
        lie_start: lieStart,
        holed: holed ? 1 : 0,
        dist_end: holed ? null : distEndYards,
        lie_end: holed ? null : lieEnd,
      };
      const updated = await api.shots.update(shot.id, payload);
      onSaved(updated);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3 pt-3 border-t border-gray-100 mt-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-gray-400">Edit shot {shot.sequence}</span>
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${catColors.bg} ${catColors.text}`}>
          {previewCat}
        </span>
      </div>

      {/* Start position */}
      {isFirstShot ? (
        <>
          <div>
            <label className="label">Starting distance (yards)</label>
            <input
              type="number"
              inputMode="decimal"
              className="input"
              value={distStartRaw}
              onChange={(e) => setDistStartRaw(e.target.value)}
            />
          </div>
          <div className="rounded-xl bg-gray-50 px-3 py-2.5 text-sm">
            <span className="text-gray-400 text-xs block mb-0.5">Starting lie</span>
            <span className="font-medium text-gray-700">Tee</span>
          </div>
        </>
      ) : (
        <div className="rounded-xl bg-gray-50 px-3 py-2.5 text-sm">
          <span className="text-gray-400 text-xs">Starting from</span>
          <div className="font-medium text-gray-700 mt-0.5">
            {fmtDist(shot.dist_start, shot.lie_start)} · {LIE_LABELS[shot.lie_start]}
            <span className="text-xs text-gray-400 ml-2">linked to previous shot</span>
          </div>
        </div>
      )}

      {/* Holed toggle */}
      <button
        type="button"
        onClick={() => setHoled(!holed)}
        className={`w-full py-3 rounded-2xl font-bold text-sm transition-colors ${
          holed
            ? 'bg-green-500 text-white'
            : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
        }`}
      >
        {holed ? '⛳ Holed it!' : 'Tap to mark as holed'}
      </button>

      {!holed && (
        <>
          <div>
            <label className="label">
              Ending distance {isPuttLie(lieEnd) ? '(feet)' : '(yards)'}
            </label>
            <input
              type="number"
              inputMode="decimal"
              className="input"
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
                    lieEnd === lie ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {LIE_LABELS[lie]}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {error && <p className="text-red-600 text-sm">{error}</p>}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="btn-primary flex-1 text-sm"
        >
          {saving ? 'Saving…' : 'Save changes'}
        </button>
        <button type="button" onClick={onCancel} className="btn-secondary text-sm">
          Cancel
        </button>
      </div>
    </div>
  );
}

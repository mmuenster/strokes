import { useState, useEffect, useRef } from 'react';
import { api } from '../api.js';
import { END_LIES, LIE_LABELS, CAT_COLORS, isPuttLie, feetToYards, fmtDist } from '../utils.js';

function autoCategory(sequence, lieStart, distYards, holePar) {
  if (sequence === 1 && lieStart === 'TEE' && holePar >= 4) return 'OTT';
  if (lieStart === 'GREEN') return 'PUTT';
  if (distYards <= 30 && lieStart !== 'TEE') return 'ARG';
  return 'APP';
}

export default function ShotEditForm({ shot, hole, isFirstShot, onSaved, onCancel }) {
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

  // The active button in the lie grid: 'HOLED' if holed, else the current lieEnd
  const activeLie = holed ? 'HOLED' : lieEnd;

  function selectLie(lie) {
    if (lie === 'HOLED') {
      setHoled(true);
    } else {
      setHoled(false);
      setLieEnd(lie);
    }
  }

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

      {/* Ending lie — location first */}
      <div>
        <label className="label">Ending location</label>
        <div className="grid grid-cols-3 gap-1.5">
          {END_LIES.map((lie) => (
            <button
              key={lie}
              type="button"
              onClick={() => selectLie(lie)}
              className={`py-2.5 px-1 rounded-xl text-xs font-semibold transition-colors ${
                activeLie === lie
                  ? 'bg-gray-700 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {LIE_LABELS[lie]}
            </button>
          ))}
          <button
            type="button"
            onClick={() => selectLie('HOLED')}
            className={`py-2.5 px-1 rounded-xl text-xs font-semibold transition-colors ${
              holed
                ? 'bg-green-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            ⛳ Holed
          </button>
        </div>
      </div>

      {/* Ending distance — only shown when not holed */}
      {!holed && (
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

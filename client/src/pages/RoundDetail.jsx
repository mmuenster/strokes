import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import HoleNav from '../components/HoleNav.jsx';
import ShotForm from '../components/ShotForm.jsx';
import ShotList from '../components/ShotList.jsx';
import SGSummaryBar from '../components/SGSummaryBar.jsx';
import { fmtScore } from '../roundStats.js';

const DEFAULT_PAR = 4;

export default function RoundDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [round, setRound] = useState(null);
  const [activeHoleId, setActiveHoleId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [addingHole, setAddingHole] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await api.rounds.get(id);
      setRound(r);
      if (!activeHoleId && r.holes.length > 0) {
        // Default to last hole with shots, or hole 1 if no shots entered yet
        const holesWithShots = r.holes.filter((h) => h.shots?.length > 0);
        const target = holesWithShots.length > 0
          ? holesWithShots[holesWithShots.length - 1]
          : r.holes[0];
        setActiveHoleId(target.id);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function addHole() {
    if (!round) return;
    const nextNum = Math.max(0, ...round.holes.map((h) => h.number)) + 1;
    if (nextNum > 18) return;
    setAddingHole(true);
    try {
      const hole = await api.holes.create(round.id, { number: nextNum, par: DEFAULT_PAR });
      setRound((r) => ({ ...r, holes: [...r.holes, hole] }));
      setActiveHoleId(hole.id);
    } catch (e) {
      alert(e.message);
    } finally {
      setAddingHole(false);
    }
  }

  function handleShotSaved(shot) {
    setRound((r) => {
      const holes = r.holes.map((h) => {
        if (h.id !== shot.hole_id) return h;
        const shots = [...(h.shots || [])];
        const idx = shots.findIndex((s) => s.id === shot.id);
        if (idx >= 0) shots[idx] = shot;
        else shots.push(shot);
        return { ...h, shots };
      });
      // Recompute SG totals from hole shots
      const allShots = holes.flatMap((h) => h.shots || []);
      const sg = computeSGTotals(allShots);
      return { ...r, holes, sg };
    });
  }

  function handleShotDeleted(shotId) {
    setRound((r) => {
      const holes = r.holes.map((h) => ({
        ...h,
        shots: (h.shots || []).filter((s) => s.id !== shotId),
      }));
      const allShots = holes.flatMap((h) => h.shots || []);
      const sg = computeSGTotals(allShots);
      return { ...r, holes, sg };
    });
  }

  async function handleShotEdited(updatedShot) {
    // Capture current state before update to detect end-position changes
    const hole = round.holes.find((h) => h.id === updatedShot.hole_id);
    const originalShot = hole?.shots.find((s) => s.id === updatedShot.id);
    const nextShot = hole?.shots.find((s) => s.sequence === updatedShot.sequence + 1);

    // Update the edited shot in state
    setRound((r) => {
      const holes = r.holes.map((h) => {
        if (h.id !== updatedShot.hole_id) return h;
        return { ...h, shots: h.shots.map((s) => s.id === updatedShot.id ? updatedShot : s) };
      });
      return { ...r, holes, sg: computeSGTotals(holes.flatMap((h) => h.shots || [])) };
    });

    // Cascade: if end position changed and there is a following shot, update its start
    const endChanged =
      !updatedShot.holed &&
      nextShot &&
      (originalShot?.dist_end !== updatedShot.dist_end ||
        originalShot?.lie_end !== updatedShot.lie_end);

    if (endChanged) {
      const cascaded = await api.shots.update(nextShot.id, {
        dist_start: updatedShot.dist_end,
        lie_start: updatedShot.lie_end,
      });
      setRound((r) => {
        const holes = r.holes.map((h) => {
          if (h.id !== cascaded.hole_id) return h;
          return { ...h, shots: h.shots.map((s) => s.id === cascaded.id ? cascaded : s) };
        });
        return { ...r, holes, sg: computeSGTotals(holes.flatMap((h) => h.shots || [])) };
      });
    }
  }

  if (loading) return <div className="text-center py-20 text-gray-400">Loading…</div>;
  if (error) return <div className="text-center py-20 text-red-500">{error}</div>;
  if (!round) return null;

  const activeHole = round.holes.find((h) => h.id === activeHoleId);
  const previousShot = activeHole?.shots?.slice(-1)[0] ?? null;

  const playedHoles = round.holes.filter((h) => (h.shots ?? []).length > 0);
  const totalStrokes = playedHoles.reduce((s, h) => s + h.shots.length, 0);
  const playedPar = playedHoles.reduce((s, h) => s + h.par, 0);

  return (
    <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/')} className="btn-ghost p-2 min-h-0 h-10 w-10 text-lg">
          ←
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="font-bold text-gray-900 truncate">{round.course_name}</h1>
          <p className="text-xs text-gray-400">
            {round.date}
            {totalStrokes > 0 && (
              <span className="ml-2 text-gray-700 font-medium">
                · {totalStrokes} ({fmtScore(totalStrokes - playedPar)})
              </span>
            )}
          </p>
        </div>
        <button
          onClick={() => navigate(`/rounds/${id}/summary`)}
          className="btn-secondary text-sm px-3 py-2"
        >
          Summary
        </button>
      </div>

      {/* SG bar */}
      <SGSummaryBar sg={round.sg} />

      {/* Hole nav */}
      {round.holes.length === 0 ? (
        <div className="card text-center py-8">
          <p className="text-gray-500 mb-3">No holes yet.</p>
          <button onClick={addHole} disabled={addingHole} className="btn-primary">
            {addingHole ? 'Adding…' : 'Add hole 1'}
          </button>
        </div>
      ) : (
        <>
          <HoleNav
            holes={round.holes}
            activeHoleId={activeHoleId}
            onSelect={setActiveHoleId}
            onAddHole={addHole}
          />

          {activeHole && (
            <>
              <div className="flex items-center justify-between px-1">
                <span className="text-sm font-medium text-gray-600">
                  Hole {activeHole.number} — Par {activeHole.par}
                  {activeHole.yardage ? ` — ${activeHole.yardage} yds` : ''}
                </span>
                <select
                  value={activeHole.par}
                  onChange={async (e) => {
                    const updated = await api.holes.update(activeHole.id, { par: Number(e.target.value) });
                    setRound((r) => ({
                      ...r,
                      holes: r.holes.map((h) => (h.id === updated.id ? { ...h, par: updated.par } : h)),
                    }));
                  }}
                  className="text-sm border border-gray-200 rounded-lg px-2 py-1"
                >
                  {[3, 4, 5].map((p) => <option key={p} value={p}>Par {p}</option>)}
                </select>
              </div>

              <ShotList
                shots={activeHole.shots ?? []}
                hole={activeHole}
                onDeleted={handleShotDeleted}
                onEdited={handleShotEdited}
              />

              <ShotForm
                hole={activeHole}
                previousShot={previousShot}
                onSaved={handleShotSaved}
              />
            </>
          )}
        </>
      )}
    </div>
  );
}

function computeSGTotals(shots) {
  const result = { ott: 0, app: 0, arg: 0, putt: 0, total: 0 };
  for (const s of shots) {
    const key = s.category.toLowerCase();
    if (key in result) result[key] += Number(s.sg);
    result.total += Number(s.sg);
  }
  return result;
}

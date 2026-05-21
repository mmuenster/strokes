import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer, Cell
} from 'recharts';
import { api } from '../api.js';
import { fmtSG, sgClass, CAT_COLORS, CAT_LABELS } from '../utils.js';
import { pct, fmtScore, avg, computeStats } from '../roundStats.js';

// ── stat UI components ────────────────────────────────────────────────────────

function StatCard({ title, children }) {
  return (
    <div className="card">
      <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">{title}</h2>
      {children}
    </div>
  );
}

function StatGrid({ children }) {
  return <div className="grid grid-cols-3 gap-y-4">{children}</div>;
}

function Stat({ label, value, sub, valueClass }) {
  return (
    <div className="text-center">
      <div className={`text-xl font-bold ${valueClass ?? 'text-gray-900'}`}>{value ?? '—'}</div>
      <div className="text-xs text-gray-400 mt-0.5 leading-tight">{label}</div>
      {sub != null && <div className="text-xs text-gray-500 mt-0.5">{sub}</div>}
    </div>
  );
}

function PctStat({ label, made, attempted }) {
  return (
    <Stat
      label={label}
      value={pct(made, attempted)}
      sub={attempted ? `${made} / ${attempted}` : null}
    />
  );
}

// ── chart tooltip ─────────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-lg p-3 text-xs">
      <p className="font-semibold mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.fill }}>
          {p.name}: {p.value >= 0 ? '+' : ''}{Number(p.value).toFixed(2)}
        </p>
      ))}
    </div>
  );
}

// ── scoring badge ─────────────────────────────────────────────────────────────

const SCORE_STYLES = {
  eagle:     { label: 'Eagle',    bg: 'bg-yellow-100', text: 'text-yellow-700' },
  birdie:    { label: 'Birdie',   bg: 'bg-green-100',  text: 'text-green-700' },
  par:       { label: 'Par',      bg: 'bg-gray-100',   text: 'text-gray-600' },
  bogey:     { label: 'Bogey',    bg: 'bg-orange-100', text: 'text-orange-700' },
  double:    { label: 'Double',   bg: 'bg-red-100',    text: 'text-red-600' },
  triplePlus:{ label: 'Triple+',  bg: 'bg-red-200',    text: 'text-red-800' },
};

function ScoringBadge({ type, count }) {
  const s = SCORE_STYLES[type];
  return (
    <div className="text-center">
      <div className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${s.bg} ${s.text} mb-1`}>
        {s.label}
      </div>
      <div className="text-xl font-bold text-gray-900">{count}</div>
    </div>
  );
}

// ── main page ─────────────────────────────────────────────────────────────────

export default function RoundSummary() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [round, setRound] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.rounds.get(id).then(setRound).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="text-center py-20 text-gray-400">Loading…</div>;
  if (!round) return null;

  const stats = computeStats(round);

  const holeData = (round.holes ?? []).map(h => {
    const shots = h.shots ?? [];
    const sg = { OTT: 0, APP: 0, ARG: 0, PUTT: 0 };
    let total = 0;
    for (const s of shots) {
      if (s.category in sg) sg[s.category] = (sg[s.category] ?? 0) + Number(s.sg);
      total += Number(s.sg);
    }
    return { hole: `H${h.number}`, total, ...sg };
  });

  const catData = ['OTT', 'APP', 'ARG', 'PUTT'].map(cat => ({
    cat,
    label: CAT_LABELS[cat],
    value: Number(round.sg?.[cat.toLowerCase()] ?? 0),
    color: CAT_COLORS[cat].bar,
  }));

  const scoreToPar = stats?.scoreToPar ?? 0;
  const scoreClass = scoreToPar < 0 ? 'text-green-600' : scoreToPar > 0 ? 'text-red-500' : 'text-gray-700';

  return (
    <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(`/rounds/${id}`)} className="btn-ghost p-2 min-h-0 h-10 w-10 text-lg">
          ←
        </button>
        <div>
          <h1 className="font-bold text-gray-900">{round.course_name}</h1>
          <p className="text-xs text-gray-400">{round.date}</p>
        </div>
      </div>

      {!stats ? (
        <div className="card text-center py-8 text-gray-400 text-sm">
          No shot data yet — enter shots from the round view.
        </div>
      ) : (
        <>
          {/* Score overview */}
          <StatCard title="Score">
            <div className="flex items-center justify-around">
              <div className="text-center">
                <div className="text-4xl font-bold text-gray-900">{stats.totalStrokes}</div>
                <div className="text-xs text-gray-400 mt-1">Total strokes</div>
              </div>
              <div className="text-center">
                <div className={`text-4xl font-bold ${scoreClass}`}>{fmtScore(stats.scoreToPar)}</div>
                <div className="text-xs text-gray-400 mt-1">vs Par {stats.totalPar}</div>
              </div>
              <div className="text-center">
                <div className="text-4xl font-bold text-gray-900">{stats.n}</div>
                <div className="text-xs text-gray-400 mt-1">Holes played</div>
              </div>
            </div>
          </StatCard>

          {/* Scoring breakdown */}
          <StatCard title="Scoring breakdown">
            <div className="grid grid-cols-3 gap-4">
              <ScoringBadge type="eagle"      count={stats.scoring.eagles} />
              <ScoringBadge type="birdie"     count={stats.scoring.birdies} />
              <ScoringBadge type="par"        count={stats.scoring.pars} />
              <ScoringBadge type="bogey"      count={stats.scoring.bogeys} />
              <ScoringBadge type="double"     count={stats.scoring.doubles} />
              <ScoringBadge type="triplePlus" count={stats.scoring.triplePlus} />
            </div>
          </StatCard>

          {/* Strokes Gained */}
          <StatCard title="Strokes gained">
            <StatGrid>
              <Stat label="Off the Tee"     value={fmtSG(stats.sg.ott)}   valueClass={sgClass(stats.sg.ott)} />
              <Stat label="Approach"        value={fmtSG(stats.sg.app)}   valueClass={sgClass(stats.sg.app)} />
              <Stat label="Around Green"    value={fmtSG(stats.sg.arg)}   valueClass={sgClass(stats.sg.arg)} />
              <Stat label="Putting"         value={fmtSG(stats.sg.putt)}  valueClass={sgClass(stats.sg.putt)} />
              <Stat label="Total"           value={fmtSG(stats.sg.total)} valueClass={sgClass(stats.sg.total)} />
            </StatGrid>
            <div className="mt-4">
              <ResponsiveContainer width="100%" height={140}>
                <BarChart data={catData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <ReferenceLine y={0} stroke="#9ca3af" />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                    {catData.map(d => <Cell key={d.cat} fill={d.value >= 0 ? d.color : '#ef4444'} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </StatCard>

          {/* Driving */}
          <StatCard title="Driving">
            <StatGrid>
              <PctStat label="Fairways hit"
                made={stats.driving.fairwaysHit}
                attempted={stats.driving.fairwaysAttempted} />
              <Stat label="Avg distance"
                value={stats.driving.avgDriveDistance != null ? `${stats.driving.avgDriveDistance} yd` : '—'} />
              <Stat label="SG: Off the Tee"
                value={fmtSG(stats.sg.ott)}
                valueClass={sgClass(stats.sg.ott)} />
            </StatGrid>
          </StatCard>

          {/* Approach */}
          <StatCard title="Approach">
            <StatGrid>
              <PctStat label="Greens in reg."
                made={stats.gir.hit}
                attempted={stats.gir.attempted} />
              <Stat label="Avg distance"
                value={stats.approach.avgDist != null ? `${stats.approach.avgDist} yd` : '—'} />
              <Stat label="Avg proximity"
                value={stats.approach.avgProximityFt != null ? `${stats.approach.avgProximityFt} ft` : '—'} />
              <Stat label="SG: Approach"
                value={fmtSG(stats.sg.app)}
                valueClass={sgClass(stats.sg.app)} />
            </StatGrid>
          </StatCard>

          {/* Around the green */}
          <StatCard title="Around the green">
            <StatGrid>
              <PctStat label="Scrambling"
                made={stats.scrambling.made}
                attempted={stats.scrambling.attempted} />
              <PctStat label="Sand saves"
                made={stats.sand.made}
                attempted={stats.sand.attempted} />
              <Stat label="SG: Around Green"
                value={fmtSG(stats.sg.arg)}
                valueClass={sgClass(stats.sg.arg)} />
            </StatGrid>
          </StatCard>

          {/* Sand shots */}
          {stats.sandDetail.total > 0 && (
            <StatCard title="Sand shots">
              <StatGrid>
                <Stat label="Total"           value={stats.sandDetail.total} />
                <Stat label="Greenside"       value={stats.sandDetail.greenside} />
                <Stat label="Fairway bunker"  value={stats.sandDetail.fairwayBunker} />
                <PctStat label="Sand saves"
                  made={stats.sand.made}
                  attempted={stats.sand.attempted} />
                <Stat label="Avg distance"
                  value={stats.sandDetail.avgDist != null ? `${stats.sandDetail.avgDist} yd` : '—'} />
                <Stat label="Avg proximity"
                  value={stats.sandDetail.avgProximityFt != null ? `${stats.sandDetail.avgProximityFt} ft` : '—'} />
                <Stat label="Avg dist. gained"
                  value={stats.sandDetail.avgDistGained != null ? `${stats.sandDetail.avgDistGained} yd` : '—'} />
                <Stat label="Holed from sand" value={stats.sandDetail.holedFromSand}
                  valueClass={stats.sandDetail.holedFromSand > 0 ? 'text-green-600' : 'text-gray-900'} />
                <Stat label="SG: Sand"
                  value={fmtSG(stats.sandDetail.totalSG)}
                  valueClass={sgClass(stats.sandDetail.totalSG)} />
              </StatGrid>
              {Object.keys(stats.sandDetail.outcomes).length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <p className="text-xs text-gray-400 mb-2">Shot outcomes</p>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(stats.sandDetail.outcomes).map(([lie, count]) => (
                      <div key={lie} className="flex items-center gap-1 bg-gray-50 rounded-lg px-2 py-1">
                        <span className="text-xs font-semibold text-gray-700">{lie}</span>
                        <span className="text-xs text-gray-400">×{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </StatCard>
          )}

          {/* Putting */}
          <StatCard title="Putting">
            <StatGrid>
              <Stat label="Total putts"    value={stats.putting.totalPutts} />
              <Stat label="Per hole"       value={stats.putting.avgPerHole} />
              <Stat label="Per GIR hole"   value={stats.putting.avgPuttsGIR ?? '—'} />
              <PctStat label="1-putt"
                made={stats.putting.onePutts}
                attempted={stats.n} />
              <Stat label="2-putt"         value={stats.putting.twoPutts} />
              <Stat label="3-putt+"        value={stats.putting.threePlusPutts}
                valueClass={stats.putting.threePlusPutts > 0 ? 'text-red-500' : 'text-gray-900'} />
              <Stat label="Feet holed" value={`${stats.putting.totalFeetHoled} ft`} />
              <Stat label="SG: Putting"
                value={fmtSG(stats.sg.putt)}
                valueClass={sgClass(stats.sg.putt)} />
            </StatGrid>
          </StatCard>

          {/* Penalties */}
          {(stats.penalties.ob > 0 || stats.penalties.hazard > 0 || stats.penalties.total > 0) && (
            <StatCard title="Penalties">
              <StatGrid>
                <Stat label="OB shots"         value={stats.penalties.ob}    valueClass={stats.penalties.ob > 0 ? 'text-red-500' : 'text-gray-900'} />
                <Stat label="Hazard shots"     value={stats.penalties.hazard} valueClass={stats.penalties.hazard > 0 ? 'text-red-500' : 'text-gray-900'} />
                <Stat label="Penalty strokes"  value={stats.penalties.total}  valueClass={stats.penalties.total > 0 ? 'text-red-500' : 'text-gray-900'} />
              </StatGrid>
            </StatCard>
          )}

          {/* Hole-by-hole SG */}
          {holeData.length > 0 && (
            <StatCard title="Hole by hole">
              <div className="space-y-2">
                {holeData.map(h => (
                  <div key={h.hole} className="flex items-center gap-2">
                    <span className="text-xs font-medium text-gray-400 w-8">{h.hole}</span>
                    <div className="flex-1 relative h-7 rounded-lg overflow-hidden bg-gray-50">
                      <div
                        className="absolute top-0 bottom-0 rounded-lg transition-all"
                        style={{
                          width: `${Math.min(100, Math.abs(h.total) * 25)}%`,
                          left: h.total >= 0 ? '50%' : 'auto',
                          right: h.total < 0 ? '50%' : 'auto',
                          backgroundColor: h.total >= 0 ? '#22c55e' : '#ef4444',
                          opacity: 0.6 + Math.min(0.4, Math.abs(h.total) * 0.15),
                        }}
                      />
                      <div className="absolute top-0 bottom-0 left-1/2 w-px bg-gray-300"
                        style={{ transform: 'translateX(-50%)' }} />
                    </div>
                    <span className={`text-xs font-bold w-12 text-right ${sgClass(h.total)}`}>
                      {fmtSG(h.total)}
                    </span>
                  </div>
                ))}
              </div>
            </StatCard>
          )}

          {/* Stacked category chart by hole */}
          {holeData.length > 0 && (
            <StatCard title="Category breakdown per hole">
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={holeData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis dataKey="hole" tick={{ fontSize: 9 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <ReferenceLine y={0} stroke="#9ca3af" />
                  <Tooltip content={<ChartTooltip />} />
                  {['OTT', 'APP', 'ARG', 'PUTT'].map(cat => (
                    <Bar key={cat} dataKey={cat} stackId="a" name={cat}
                      fill={CAT_COLORS[cat].bar}
                      radius={cat === 'PUTT' ? [4, 4, 0, 0] : [0, 0, 0, 0]} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </StatCard>
          )}
        </>
      )}
    </div>
  );
}

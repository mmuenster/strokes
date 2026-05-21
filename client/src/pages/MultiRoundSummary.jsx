import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer, Cell
} from 'recharts';
import { api } from '../api.js';
import { fmtSG, sgClass, CAT_COLORS, CAT_LABELS } from '../utils.js';
import { pct, fmtScore, computeStats } from '../roundStats.js';

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

const SCORE_STYLES = {
  eagle:      { label: 'Eagle',   bg: 'bg-yellow-100', text: 'text-yellow-700' },
  birdie:     { label: 'Birdie',  bg: 'bg-green-100',  text: 'text-green-700' },
  par:        { label: 'Par',     bg: 'bg-gray-100',   text: 'text-gray-600' },
  bogey:      { label: 'Bogey',   bg: 'bg-orange-100', text: 'text-orange-700' },
  double:     { label: 'Double',  bg: 'bg-red-100',    text: 'text-red-600' },
  triplePlus: { label: 'Triple+', bg: 'bg-red-200',    text: 'text-red-800' },
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

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-lg p-3 text-xs">
      <p className="font-semibold mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.fill ?? p.stroke }}>
          {p.name}: {p.value >= 0 ? '+' : ''}{Number(p.value).toFixed(2)}
        </p>
      ))}
    </div>
  );
}

// ── main page ─────────────────────────────────────────────────────────────────

export default function MultiRoundSummary() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [rounds, setRounds] = useState([]);
  const [loading, setLoading] = useState(true);

  const ids = (searchParams.get('rounds') ?? '').split(',').filter(Boolean);

  useEffect(() => {
    if (!ids.length) { setLoading(false); return; }
    Promise.all(ids.map(id => api.rounds.get(id)))
      .then(setRounds)
      .finally(() => setLoading(false));
  }, [searchParams.get('rounds')]);

  if (loading) return <div className="text-center py-20 text-gray-400">Loading…</div>;
  if (!rounds.length) return <div className="text-center py-20 text-gray-400">No rounds selected.</div>;

  // Build combined round: merge all holes, sum SG
  const combinedRound = {
    holes: rounds.flatMap(r => r.holes ?? []),
    sg: rounds.reduce((acc, r) => {
      const sg = r.sg ?? {};
      return {
        ott:   (acc.ott   ?? 0) + Number(sg.ott   ?? 0),
        app:   (acc.app   ?? 0) + Number(sg.app   ?? 0),
        arg:   (acc.arg   ?? 0) + Number(sg.arg   ?? 0),
        putt:  (acc.putt  ?? 0) + Number(sg.putt  ?? 0),
        total: (acc.total ?? 0) + Number(sg.total ?? 0),
      };
    }, {}),
  };

  const stats = computeStats(combinedRound);

  // Per-round breakdown for chart
  const roundData = rounds.map((r, i) => {
    const sg = r.sg ?? {};
    const label = r.course_name.split('—')[0].trim().split(' ').slice(0, 2).join(' ');
    return {
      label: `R${i + 1}`,
      fullLabel: label,
      date: r.date,
      OTT:  Number(sg.ott   ?? 0),
      APP:  Number(sg.app   ?? 0),
      ARG:  Number(sg.arg   ?? 0),
      PUTT: Number(sg.putt  ?? 0),
      total: Number(sg.total ?? 0),
    };
  });

  const catData = ['OTT', 'APP', 'ARG', 'PUTT'].map(cat => ({
    cat,
    label: CAT_LABELS[cat],
    value: Number(combinedRound.sg?.[cat.toLowerCase()] ?? 0),
    color: CAT_COLORS[cat].bar,
  }));

  const scoreToPar = stats?.scoreToPar ?? 0;
  const scoreClass = scoreToPar < 0 ? 'text-green-600' : scoreToPar > 0 ? 'text-red-500' : 'text-gray-700';

  const avgScoreToPar = stats ? (scoreToPar / rounds.length).toFixed(1) : '—';
  const avgHoles = stats ? (stats.n / rounds.length).toFixed(1) : '—';

  return (
    <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/')} className="btn-ghost p-2 min-h-0 h-10 w-10 text-lg">
          ←
        </button>
        <div>
          <h1 className="font-bold text-gray-900">{rounds.length} rounds combined</h1>
          <p className="text-xs text-gray-400">
            {rounds.map(r => r.date).sort()[0]} – {rounds.map(r => r.date).sort().slice(-1)[0]}
          </p>
        </div>
      </div>

      {/* Rounds list */}
      <StatCard title="Rounds included">
        <div className="space-y-2">
          {rounds.map((r, i) => {
            const rsg = r.sg ?? {};
            const rHoles = (r.holes ?? []).filter(h => (h.shots ?? []).length > 0);
            const rStrokes = rHoles.reduce((s, h) => s + h.shots.length, 0);
            const rPar = rHoles.reduce((s, h) => s + h.par, 0);
            const rSTP = rStrokes - rPar;
            return (
              <div key={r.id} className="flex items-center justify-between text-sm">
                <div>
                  <span className="text-xs font-semibold text-gray-400 mr-2">R{i + 1}</span>
                  <span className="text-gray-700">{r.course_name}</span>
                  <span className="text-gray-400 text-xs ml-2">{r.date}</span>
                </div>
                <span className={`font-bold text-sm ${sgClass(rsg.total)}`}>
                  {fmtScore(rSTP)}
                </span>
              </div>
            );
          })}
        </div>
      </StatCard>

      {!stats ? (
        <div className="card text-center py-8 text-gray-400 text-sm">
          No shot data in selected rounds.
        </div>
      ) : (
        <>
          {/* Score overview */}
          <StatCard title="Score (combined)">
            <div className="flex items-center justify-around">
              <div className="text-center">
                <div className="text-4xl font-bold text-gray-900">{stats.totalStrokes}</div>
                <div className="text-xs text-gray-400 mt-1">Total strokes</div>
              </div>
              <div className="text-center">
                <div className={`text-4xl font-bold ${scoreClass}`}>{fmtScore(scoreToPar)}</div>
                <div className="text-xs text-gray-400 mt-1">vs Par {stats.totalPar}</div>
              </div>
              <div className="text-center">
                <div className="text-4xl font-bold text-gray-900">{rounds.length}</div>
                <div className="text-xs text-gray-400 mt-1">Rounds</div>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-3 gap-2 text-center">
              <div>
                <div className="text-lg font-bold text-gray-900">{avgScoreToPar >= 0 ? '+' : ''}{avgScoreToPar}</div>
                <div className="text-xs text-gray-400">Avg score/round</div>
              </div>
              <div>
                <div className="text-lg font-bold text-gray-900">{stats.n}</div>
                <div className="text-xs text-gray-400">Total holes</div>
              </div>
              <div>
                <div className="text-lg font-bold text-gray-900">{avgHoles}</div>
                <div className="text-xs text-gray-400">Avg holes/round</div>
              </div>
            </div>
          </StatCard>

          {/* Per-round SG chart */}
          {roundData.length > 1 && (
            <StatCard title="SG per round">
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={roundData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <ReferenceLine y={0} stroke="#9ca3af" />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null;
                      const d = roundData.find(r => r.label === label);
                      return (
                        <div className="bg-white border border-gray-200 rounded-xl shadow-lg p-3 text-xs">
                          <p className="font-semibold mb-1">{d?.fullLabel} ({d?.date})</p>
                          {payload.map(p => (
                            <p key={p.name} style={{ color: p.fill }}>
                              {p.name}: {p.value >= 0 ? '+' : ''}{Number(p.value).toFixed(2)}
                            </p>
                          ))}
                        </div>
                      );
                    }}
                  />
                  {['OTT', 'APP', 'ARG', 'PUTT'].map(cat => (
                    <Bar key={cat} dataKey={cat} stackId="a" name={cat}
                      fill={CAT_COLORS[cat].bar}
                      radius={cat === 'PUTT' ? [4, 4, 0, 0] : [0, 0, 0, 0]} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </StatCard>
          )}

          {/* Scoring breakdown */}
          <StatCard title="Scoring breakdown (combined)">
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
          <StatCard title="Strokes gained (combined)">
            <StatGrid>
              <Stat label="Off the Tee"  value={fmtSG(stats.sg.ott)}   valueClass={sgClass(stats.sg.ott)} />
              <Stat label="Approach"     value={fmtSG(stats.sg.app)}   valueClass={sgClass(stats.sg.app)} />
              <Stat label="Around Green" value={fmtSG(stats.sg.arg)}   valueClass={sgClass(stats.sg.arg)} />
              <Stat label="Putting"      value={fmtSG(stats.sg.putt)}  valueClass={sgClass(stats.sg.putt)} />
              <Stat label="Total"        value={fmtSG(stats.sg.total)} valueClass={sgClass(stats.sg.total)} />
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
              <Stat label="Avg drive distance"
                value={stats.driving.avgDriveDistance != null ? `${stats.driving.avgDriveDistance} yd` : '—'} />
              <Stat label="SG: Off the Tee"
                value={fmtSG(stats.sg.ott)} valueClass={sgClass(stats.sg.ott)} />
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
                value={fmtSG(stats.sg.app)} valueClass={sgClass(stats.sg.app)} />
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
                value={fmtSG(stats.sg.arg)} valueClass={sgClass(stats.sg.arg)} />
            </StatGrid>
          </StatCard>

          {/* Sand shots */}
          {stats.sandDetail.total > 0 && (
            <StatCard title="Sand shots">
              <StatGrid>
                <Stat label="Total"          value={stats.sandDetail.total} />
                <Stat label="Greenside"      value={stats.sandDetail.greenside} />
                <Stat label="Fairway bunker" value={stats.sandDetail.fairwayBunker} />
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
              <Stat label="Total putts"  value={stats.putting.totalPutts} />
              <Stat label="Per hole"     value={stats.putting.avgPerHole} />
              <Stat label="Per GIR hole" value={stats.putting.avgPuttsGIR ?? '—'} />
              <PctStat label="1-putt"
                made={stats.putting.onePutts}
                attempted={stats.n} />
              <Stat label="2-putt"       value={stats.putting.twoPutts} />
              <Stat label="3-putt+"      value={stats.putting.threePlusPutts}
                valueClass={stats.putting.threePlusPutts > 0 ? 'text-red-500' : 'text-gray-900'} />
              <Stat label="Feet holed"   value={`${stats.putting.totalFeetHoled} ft`} />
              <Stat label="SG: Putting"
                value={fmtSG(stats.sg.putt)} valueClass={sgClass(stats.sg.putt)} />
            </StatGrid>
          </StatCard>

          {/* Penalties */}
          {(stats.penalties.ob > 0 || stats.penalties.hazard > 0 || stats.penalties.total > 0) && (
            <StatCard title="Penalties">
              <StatGrid>
                <Stat label="OB shots"        value={stats.penalties.ob}
                  valueClass={stats.penalties.ob > 0 ? 'text-red-500' : 'text-gray-900'} />
                <Stat label="Hazard shots"    value={stats.penalties.hazard}
                  valueClass={stats.penalties.hazard > 0 ? 'text-red-500' : 'text-gray-900'} />
                <Stat label="Penalty strokes" value={stats.penalties.total}
                  valueClass={stats.penalties.total > 0 ? 'text-red-500' : 'text-gray-900'} />
              </StatGrid>
            </StatCard>
          )}
        </>
      )}
    </div>
  );
}

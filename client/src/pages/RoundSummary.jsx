import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer, Cell
} from 'recharts';
import { api } from '../api.js';
import SGSummaryBar from '../components/SGSummaryBar.jsx';
import { fmtSG, sgClass, CAT_COLORS, CAT_LABELS } from '../utils.js';

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

  // Per-hole SG data
  const holeData = round.holes.map((h) => {
    const shots = h.shots ?? [];
    const sg = { OTT: 0, APP: 0, ARG: 0, PUTT: 0 };
    let total = 0;
    for (const s of shots) {
      sg[s.category] = (sg[s.category] ?? 0) + Number(s.sg);
      total += Number(s.sg);
    }
    return { hole: `H${h.number}`, total, ...sg };
  });

  // Category breakdown
  const catData = ['OTT', 'APP', 'ARG', 'PUTT'].map((cat) => ({
    cat,
    label: CAT_LABELS[cat],
    value: Number(round.sg?.[cat.toLowerCase()] ?? 0),
    color: CAT_COLORS[cat].bar,
  }));

  const CustomTooltip = ({ active, payload, label }) => {
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
  };

  return (
    <div className="max-w-lg mx-auto px-4 py-4 space-y-6">
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

      <SGSummaryBar sg={round.sg} />

      {/* Category chart */}
      <div className="card">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
          By category
        </h2>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={catData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
            <XAxis dataKey="label" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <ReferenceLine y={0} stroke="#9ca3af" />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="value" radius={[6, 6, 0, 0]}>
              {catData.map((d) => (
                <Cell key={d.cat} fill={d.value >= 0 ? d.color : '#ef4444'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Hole-by-hole heatmap */}
      {holeData.length > 0 && (
        <div className="card">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Hole by hole
          </h2>
          <div className="space-y-2">
            {holeData.map((h) => (
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
                  <div
                    className="absolute top-0 bottom-0 left-1/2 w-px bg-gray-300"
                    style={{ transform: 'translateX(-50%)' }}
                  />
                </div>
                <span className={`text-xs font-bold w-12 text-right ${sgClass(h.total)}`}>
                  {fmtSG(h.total)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stacked category chart by hole */}
      {holeData.length > 0 && (
        <div className="card">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
            Category breakdown per hole
          </h2>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={holeData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
              <XAxis dataKey="hole" tick={{ fontSize: 9 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <ReferenceLine y={0} stroke="#9ca3af" />
              <Tooltip content={<CustomTooltip />} />
              {['OTT', 'APP', 'ARG', 'PUTT'].map((cat) => (
                <Bar key={cat} dataKey={cat} stackId="a" name={cat}
                  fill={CAT_COLORS[cat].bar} radius={cat === 'PUTT' ? [4, 4, 0, 0] : [0, 0, 0, 0]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {holeData.length === 0 && (
        <div className="card text-center py-8 text-gray-400 text-sm">
          No shot data yet — enter shots from the round view.
        </div>
      )}
    </div>
  );
}

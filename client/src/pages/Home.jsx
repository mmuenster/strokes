import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../api.js';
import RoundForm from '../components/RoundForm.jsx';
import { fmtSG, sgClass, CAT_COLORS } from '../utils.js';
import { fmtScore } from '../roundStats.js';

export default function Home() {
  const [rounds, setRounds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const navigate = useNavigate();

  useEffect(() => {
    api.rounds.list().then(setRounds).finally(() => setLoading(false));
  }, []);

  function handleCreated(round) {
    setShowForm(false);
    navigate(`/rounds/${round.id}`);
  }

  function toggleSelect(id) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function exitSelecting() {
    setSelecting(false);
    setSelectedIds(new Set());
  }

  async function handleDelete(e, roundId) {
    e.stopPropagation();
    if (!confirm('Delete this round?')) return;
    await api.rounds.delete(roundId);
    setRounds((r) => r.filter((x) => x.id !== roundId));
  }

  const cats = ['OTT', 'APP', 'ARG', 'PUTT'];

  return (
    <div className={`max-w-lg mx-auto px-4 py-6 space-y-6 ${selecting && selectedIds.size > 0 ? 'pb-24' : ''}`}>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Strokes Gained</h1>
          <Link to="/courses/new" className="text-xs text-green-600 hover:underline">+ Add course</Link>
        </div>
        <div className="flex gap-2">
          {!selecting ? (
            <>
              <button onClick={() => setSelecting(true)} className="btn-secondary px-3 py-2 text-sm">
                Select
              </button>
              <button onClick={() => setShowForm(true)} className="btn-primary px-5 py-2.5">
                + New round
              </button>
            </>
          ) : (
            <button onClick={exitSelecting} className="btn-secondary px-3 py-2 text-sm">
              Cancel
            </button>
          )}
        </div>
      </div>

      {showForm && (
        <div className="card">
          <h2 className="text-lg font-semibold mb-4">New round</h2>
          <RoundForm onCreated={handleCreated} onCancel={() => setShowForm(false)} />
        </div>
      )}

      {loading ? (
        <p className="text-center text-gray-400 py-12">Loading…</p>
      ) : rounds.length === 0 ? (
        <div className="card text-center py-12">
          <div className="text-5xl mb-3">⛳</div>
          <p className="text-gray-500">No rounds yet.</p>
          <p className="text-gray-400 text-sm mt-1">Tap "New round" to start tracking.</p>
        </div>
      ) : (
        <>
        <div className="space-y-3">
          {rounds.map((r) => {
            const isSelected = selectedIds.has(r.id);
            return (
              <div
                key={r.id}
                onClick={() => selecting ? toggleSelect(r.id) : navigate(`/rounds/${r.id}`)}
                className={`card cursor-pointer hover:shadow-md transition-shadow ${
                  selecting && isSelected ? 'ring-2 ring-green-500' : ''
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-start gap-2">
                    {selecting && (
                      <div className={`mt-0.5 w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
                        isSelected ? 'bg-green-600 border-green-600' : 'border-gray-300'
                      }`}>
                        {isSelected && <span className="text-white text-[10px] font-bold">✓</span>}
                      </div>
                    )}
                    <div>
                      <div className="font-semibold text-gray-900">{r.course_name}</div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        {r.date} · {r.holes_played} holes · {r.profile === 'hdcp15' ? '15 hdcp' : 'Scratch'}
                      </div>
                      {Number(r.total_strokes) > 0 && (
                        <div className="text-sm font-medium text-gray-700 mt-1">
                          {r.total_strokes} strokes
                          <span className="text-gray-400 ml-1.5">
                            ({fmtScore(Number(r.total_strokes) - Number(r.played_par))})
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-lg font-bold ${sgClass(r.sg_total)}`}>
                      {fmtSG(r.sg_total)}
                    </span>
                    {!selecting && (
                      <button
                        onClick={(e) => handleDelete(e, r.id)}
                        className="text-gray-300 hover:text-red-400 text-xl leading-none p-1"
                      >
                        ×
                      </button>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  {cats.map((cat) => {
                    const val = r[`sg_${cat.toLowerCase()}`] ?? 0;
                    const colors = CAT_COLORS[cat];
                    return (
                      <div key={cat} className={`rounded-lg px-2 py-1 text-center ${colors.bg}`}>
                        <div className={`text-[10px] font-medium ${colors.text}`}>{cat}</div>
                        <div className={`text-xs font-bold ${sgClass(val)}`}>{fmtSG(val)}</div>
                      </div>
                    );
                  })}
                </div>
                {!selecting && (
                  <div className="mt-2 text-right">
                    <button
                      onClick={(e) => { e.stopPropagation(); navigate(`/rounds/${r.id}/summary`); }}
                      className="text-xs text-green-600 hover:underline"
                    >
                      View summary →
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Sticky summary bar */}
        {selecting && selectedIds.size > 0 && (
          <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg px-4 py-3 flex items-center justify-between">
            <span className="text-sm text-gray-600">{selectedIds.size} round{selectedIds.size > 1 ? 's' : ''} selected</span>
            <button
              onClick={() => navigate(`/multi-summary?rounds=${[...selectedIds].join(',')}`)}
              className="btn-primary px-5 py-2"
            >
              View combined summary
            </button>
          </div>
        )}
        </>
      )}
    </div>
  );
}

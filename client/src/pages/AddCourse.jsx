import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';

export default function AddCourse() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', city: '', state: 'CA' });
  const [looking, setLooking] = useState(false);
  const [result, setResult] = useState(null); // { found, name, city, state, tees, url }
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);
  const [previewTeeIdx, setPreviewTeeIdx] = useState(0);

  function set(field, val) { setForm(f => ({ ...f, [field]: val })); }

  async function lookup(e) {
    e.preventDefault();
    if (!form.name.trim() || !form.city.trim()) return setError('Enter course name and city.');
    setError(null);
    setResult(null);
    setLooking(true);
    try {
      const data = await api.courses.lookup({ name: form.name.trim(), city: form.city.trim(), state: form.state.trim() });
      setResult(data);
      setPreviewTeeIdx(0);
      if (!data.found) setError(`Course not found on GolfLink. Try adjusting the name or city spelling.`);
    } catch (err) {
      setError(err.message);
    } finally {
      setLooking(false);
    }
  }

  async function save() {
    if (!result?.found) return;
    setSaving(true);
    setError(null);
    try {
      await api.courses.create({ name: result.name, city: result.city, state: result.state, tees: result.tees });
      setSaved(true);
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  const previewTee = result?.found ? result.tees[previewTeeIdx] : null;

  return (
    <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/')} className="btn-ghost p-2 min-h-0 h-10 w-10 text-lg">←</button>
        <h1 className="font-bold text-gray-900">Add a course</h1>
      </div>

      {/* Search form */}
      <div className="card space-y-3">
        <p className="text-sm text-gray-500">Enter the course name and city — the app will look up the full scorecard automatically.</p>
        <form onSubmit={lookup} className="space-y-3">
          <div>
            <label className="label">Course name</label>
            <input className="input" placeholder="Pebble Beach Golf Links"
              value={form.name} onChange={e => set('name', e.target.value)} />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2">
              <label className="label">City</label>
              <input className="input" placeholder="Pebble Beach"
                value={form.city} onChange={e => set('city', e.target.value)} />
            </div>
            <div>
              <label className="label">State</label>
              <input className="input" placeholder="CA" maxLength={2}
                value={form.state} onChange={e => set('state', e.target.value.toUpperCase())} />
            </div>
          </div>
          <button type="submit" disabled={looking} className="btn-primary w-full">
            {looking ? 'Looking up…' : 'Look up scorecard'}
          </button>
        </form>
      </div>

      {error && <p className="text-red-600 text-sm px-1">{error}</p>}

      {/* Results */}
      {result?.found && !saved && (
        <div className="card space-y-4">
          <div>
            <h2 className="font-semibold text-gray-900">{result.name}</h2>
            <p className="text-xs text-gray-400">{result.city}, {result.state} · {result.tees.length} tee set{result.tees.length > 1 ? 's' : ''}</p>
          </div>

          {/* Tee tabs */}
          <div>
            <div className="flex flex-wrap gap-1 mb-3">
              {result.tees.map((t, i) => (
                <button key={i} type="button"
                  onClick={() => setPreviewTeeIdx(i)}
                  className={`px-3 py-1 rounded-lg text-sm font-semibold transition-colors ${
                    i === previewTeeIdx ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-600'
                  }`}>
                  {t.name}
                  {t.gender === 'F' && <span className="ml-1 text-[10px] opacity-70">W</span>}
                </button>
              ))}
            </div>

            {previewTee && (
              <>
                <div className="text-xs text-gray-400 mb-2">
                  {previewTee.holes.reduce((s, h) => s + h.yardage, 0).toLocaleString()} yds ·{' '}
                  {previewTee.rating}/{previewTee.slope}
                </div>
                {/* Hole preview grid */}
                <div className="grid grid-cols-9 gap-1 text-center text-xs">
                  {previewTee.holes.slice(0, 9).map(h => (
                    <div key={h.number} className="bg-gray-50 rounded-lg py-1.5">
                      <div className="text-gray-400 font-medium">{h.number}</div>
                      <div className="font-bold text-gray-700">{h.yardage}</div>
                      <div className="text-gray-400">p{h.par}</div>
                    </div>
                  ))}
                  {previewTee.holes.length === 18 && previewTee.holes.slice(9).map(h => (
                    <div key={h.number} className="bg-gray-50 rounded-lg py-1.5">
                      <div className="text-gray-400 font-medium">{h.number}</div>
                      <div className="font-bold text-gray-700">{h.yardage}</div>
                      <div className="text-gray-400">p{h.par}</div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="flex gap-2 pt-1">
            <button onClick={save} disabled={saving} className="btn-primary flex-1">
              {saving ? 'Saving…' : 'Save to database'}
            </button>
            <button onClick={() => setResult(null)} className="btn-secondary">
              Cancel
            </button>
          </div>
        </div>
      )}

      {saved && (
        <div className="card text-center py-8 space-y-3">
          <div className="text-4xl">⛳</div>
          <p className="font-semibold text-gray-900">{result.name} saved!</p>
          <p className="text-sm text-gray-400">It will now appear in the course picker when starting a new round.</p>
          <div className="flex gap-2 justify-center pt-2">
            <button onClick={() => { setResult(null); setSaved(false); setForm({ name: '', city: '', state: 'CA' }); }}
              className="btn-secondary">
              Add another
            </button>
            <button onClick={() => navigate('/')} className="btn-primary">
              Back to home
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

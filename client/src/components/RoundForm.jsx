import { useState, useEffect } from 'react';
import { api } from '../api.js';

export default function RoundForm({ onCreated, onCancel }) {
  const today = new Date().toISOString().slice(0, 10);

  const [courses, setCourses] = useState([]);
  const [mode, setMode] = useState('pick'); // 'pick' | 'new'
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [courseDetail, setCourseDetail] = useState(null);
  const [selectedTeeId, setSelectedTeeId] = useState('');

  const [form, setForm] = useState({ course_name: '', date: today, notes: '', profile: 'scratch' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.courses.list().then(setCourses);
  }, []);

  useEffect(() => {
    if (!selectedCourseId) { setCourseDetail(null); setSelectedTeeId(''); return; }
    api.courses.get(selectedCourseId).then((c) => {
      setCourseDetail(c);
      setSelectedTeeId('');
    });
  }, [selectedCourseId]);

  function set(field, val) {
    setForm((f) => ({ ...f, [field]: val }));
  }

  async function submit(e) {
    e.preventDefault();
    setError(null);

    let body;
    if (mode === 'pick') {
      if (!selectedCourseId) return setError('Select a course.');
      if (!selectedTeeId) return setError('Select a tee.');
      const tee = courseDetail?.tees.find((t) => String(t.id) === String(selectedTeeId));
      const courseName = `${courseDetail.name} — ${tee?.name ?? ''} tees`;
      body = { course_name: courseName, date: form.date, notes: form.notes, profile: form.profile, course_tee_id: Number(selectedTeeId) };
    } else {
      if (!form.course_name.trim()) return setError('Enter a course name.');
      body = { course_name: form.course_name.trim(), date: form.date, notes: form.notes, profile: form.profile };
    }

    setSaving(true);
    try {
      const round = await api.rounds.create(body);
      onCreated(round);
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  const selectedTee = courseDetail?.tees.find((t) => String(t.id) === String(selectedTeeId));

  return (
    <form onSubmit={submit} className="space-y-4">
      {/* Mode toggle */}
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => setMode('pick')}
          className={`btn ${mode === 'pick' ? 'btn-primary' : 'btn-secondary'}`}>
          Saved course
        </button>
        <button type="button" onClick={() => setMode('new')}
          className={`btn ${mode === 'new' ? 'btn-primary' : 'btn-secondary'}`}>
          New course
        </button>
      </div>

      {mode === 'pick' ? (
        <>
          <div>
            <label className="label">Course</label>
            <select className="input" value={selectedCourseId}
              onChange={(e) => setSelectedCourseId(e.target.value)}>
              <option value="">Select a course…</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>{c.name} — {c.city}, {c.state}</option>
              ))}
            </select>
          </div>

          {courseDetail && (
            <div>
              <label className="label">Tees</label>
              <div className="grid grid-cols-2 gap-2">
                {courseDetail.tees.map((t) => (
                  <button key={t.id} type="button"
                    onClick={() => setSelectedTeeId(String(t.id))}
                    className={`btn text-left ${String(selectedTeeId) === String(t.id) ? 'btn-primary' : 'btn-secondary'}`}>
                    <div className="font-semibold">{t.name}</div>
                    <div className="text-[11px] opacity-75">{t.total_yardage} yds · {t.rating}/{t.slope}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {selectedTee && (
            <div className="bg-gray-50 rounded-xl p-3 text-xs text-gray-500 grid grid-cols-9 gap-1 text-center">
              {selectedTee.holes.map((h) => (
                <div key={h.number}>
                  <div className="font-semibold text-gray-400">{h.number}</div>
                  <div className="font-bold text-gray-700">{h.yardage}</div>
                  <div className="text-gray-400">p{h.par}</div>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <div>
          <label className="label">Course name</label>
          <input className="input" placeholder="Augusta National"
            value={form.course_name} onChange={(e) => set('course_name', e.target.value)} autoFocus />
        </div>
      )}

      <div>
        <label className="label">Date</label>
        <input type="date" className="input" value={form.date}
          onChange={(e) => set('date', e.target.value)} />
      </div>

      <div>
        <label className="label">Baseline</label>
        <div className="grid grid-cols-2 gap-2">
          {[['scratch', 'Scratch / PGA Tour'], ['hdcp15', '~15 Handicap']].map(([val, label]) => (
            <button key={val} type="button" onClick={() => set('profile', val)}
              className={`btn ${form.profile === val ? 'btn-primary' : 'btn-secondary'}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="label">Notes (optional)</label>
        <input className="input" placeholder="Windy, played from blues"
          value={form.notes} onChange={(e) => set('notes', e.target.value)} />
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      <div className="flex gap-2 pt-2">
        <button type="submit" disabled={saving} className="btn-primary flex-1">
          {saving ? 'Creating…' : 'Start round'}
        </button>
        <button type="button" onClick={onCancel} className="btn-secondary">
          Cancel
        </button>
      </div>
    </form>
  );
}

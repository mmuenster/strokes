import { useState } from 'react';
import { api } from '../api.js';

export default function RoundForm({ onCreated, onCancel }) {
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({ course_name: '', date: today, notes: '', profile: 'scratch' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  function set(field, val) {
    setForm((f) => ({ ...f, [field]: val }));
  }

  async function submit(e) {
    e.preventDefault();
    if (!form.course_name.trim()) return setError('Enter a course name.');
    setSaving(true);
    setError(null);
    try {
      const round = await api.rounds.create(form);
      onCreated(round);
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="label">Course name</label>
        <input
          className="input"
          placeholder="Augusta National"
          value={form.course_name}
          onChange={(e) => set('course_name', e.target.value)}
          autoFocus
        />
      </div>
      <div>
        <label className="label">Date</label>
        <input
          type="date"
          className="input"
          value={form.date}
          onChange={(e) => set('date', e.target.value)}
        />
      </div>
      <div>
        <label className="label">Baseline</label>
        <div className="grid grid-cols-2 gap-2">
          {[['scratch', 'Scratch / PGA Tour'], ['hdcp15', '~15 Handicap']].map(([val, label]) => (
            <button
              key={val}
              type="button"
              onClick={() => set('profile', val)}
              className={`btn ${form.profile === val ? 'btn-primary' : 'btn-secondary'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="label">Notes (optional)</label>
        <input
          className="input"
          placeholder="Windy, played from blues"
          value={form.notes}
          onChange={(e) => set('notes', e.target.value)}
        />
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

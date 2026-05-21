import { useState } from 'react';
import { fmtSG, sgClass, fmtDist, CAT_COLORS, LIE_LABELS } from '../utils.js';
import { api } from '../api.js';
import ShotEditForm from './ShotEditForm.jsx';

export default function ShotList({ shots, hole, onDeleted, onEdited }) {
  const [editingId, setEditingId] = useState(null);

  if (!shots.length) {
    return (
      <p className="text-center text-gray-400 py-6 text-sm">
        No shots yet — add your first shot below.
      </p>
    );
  }

  async function del(shot) {
    if (!confirm(`Delete shot ${shot.sequence}?`)) return;
    await api.shots.delete(shot.id);
    setEditingId(null);
    onDeleted(shot.id);
  }

  return (
    <div className="space-y-2">
      {shots.map((shot, idx) => {
        const colors = CAT_COLORS[shot.category];
        const isEditing = editingId === shot.id;

        return (
          <div key={shot.id} className="card">
            {/* Shot summary row */}
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-600">
                  {shot.sequence}
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${colors.bg} ${colors.text}`}>
                    {shot.category}
                  </span>
                  <span className={`text-base font-bold ${sgClass(shot.sg)}`}>
                    {fmtSG(shot.sg)}
                  </span>
                </div>
                <div className="text-xs text-gray-500">
                  {shot.category === 'PENALTY'
                    ? `Penalty stroke — from ${fmtDist(shot.dist_start, shot.lie_start)}`
                    : <>
                        {fmtDist(shot.dist_start, shot.lie_start)} {LIE_LABELS[shot.lie_start]}
                        {shot.holed
                          ? ' → Holed!'
                          : ` → ${fmtDist(shot.dist_end, shot.lie_end)} ${LIE_LABELS[shot.lie_end] ?? ''}`}
                      </>
                  }
                </div>
              </div>
              <div className="flex gap-1 flex-shrink-0">
                <button
                  onClick={() => setEditingId(isEditing ? null : shot.id)}
                  className={`p-1 min-h-0 h-8 w-8 text-sm rounded-lg transition-colors flex items-center justify-center ${
                    isEditing
                      ? 'bg-green-100 text-green-700'
                      : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100'
                  }`}
                  aria-label="Edit shot"
                >
                  ✎
                </button>
                <button
                  onClick={() => del(shot)}
                  className="p-1 min-h-0 h-8 w-8 text-lg leading-none rounded-lg text-red-300 hover:text-red-500 hover:bg-red-50 flex items-center justify-center transition-colors"
                  aria-label="Delete shot"
                >
                  ×
                </button>
              </div>
            </div>

            {/* Inline edit form */}
            {isEditing && (
              <ShotEditForm
                shot={shot}
                hole={hole}
                isFirstShot={idx === 0}
                onSaved={(updated) => {
                  setEditingId(null);
                  onEdited(updated);
                }}
                onCancel={() => setEditingId(null)}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

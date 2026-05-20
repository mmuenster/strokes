import { fmtSG, sgClass, fmtDist, CAT_COLORS, CAT_LABELS, LIE_LABELS } from '../utils.js';
import { api } from '../api.js';

export default function ShotList({ shots, onDeleted }) {
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
    onDeleted(shot.id);
  }

  return (
    <div className="space-y-2">
      {shots.map((shot) => {
        const colors = CAT_COLORS[shot.category];
        return (
          <div key={shot.id} className="card flex items-start gap-3">
            <div className="flex-shrink-0 text-center">
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
                {fmtDist(shot.dist_start, shot.lie_start)} {LIE_LABELS[shot.lie_start]}
                {shot.holed
                  ? ' → Holed!'
                  : ` → ${fmtDist(shot.dist_end, shot.lie_end)} ${LIE_LABELS[shot.lie_end] ?? ''}`}
              </div>
            </div>
            <button
              onClick={() => del(shot)}
              className="btn-ghost text-red-400 hover:text-red-600 p-1 min-h-0 h-8 w-8 text-lg leading-none"
              aria-label="Delete shot"
            >
              ×
            </button>
          </div>
        );
      })}
    </div>
  );
}

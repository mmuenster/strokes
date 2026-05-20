import { fmtSG, sgClass, CAT_LABELS, CAT_COLORS } from '../utils.js';

export default function SGSummaryBar({ sg }) {
  const cats = ['OTT', 'APP', 'ARG', 'PUTT'];
  const total = sg?.total ?? 0;

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-gray-500 uppercase tracking-wide">Strokes Gained</span>
        <span className={`text-xl font-bold ${sgClass(total)}`}>{fmtSG(total)}</span>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {cats.map((cat) => {
          const val = sg?.[cat.toLowerCase()] ?? 0;
          const colors = CAT_COLORS[cat];
          return (
            <div key={cat} className={`rounded-xl p-2 text-center ${colors.bg}`}>
              <div className={`text-xs font-medium ${colors.text} mb-0.5`}>
                {cat}
              </div>
              <div className={`text-base font-bold ${sgClass(val)}`}>
                {fmtSG(val)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

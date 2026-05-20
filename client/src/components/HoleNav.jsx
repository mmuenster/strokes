export default function HoleNav({ holes, activeHoleId, onSelect, onAddHole }) {
  return (
    <div className="overflow-x-auto -mx-4 px-4">
      <div className="flex gap-2 pb-1 min-w-max">
        {holes.map((h) => (
          <button
            key={h.id}
            onClick={() => onSelect(h.id)}
            className={`min-w-[48px] h-12 rounded-xl text-sm font-bold transition-colors ${
              h.id === activeHoleId
                ? 'bg-green-600 text-white'
                : 'bg-white text-gray-700 border border-gray-200 hover:border-green-400'
            }`}
          >
            <div>{h.number}</div>
            <div className="text-[10px] opacity-75">P{h.par}</div>
          </button>
        ))}
        {holes.length < 18 && (
          <button
            onClick={onAddHole}
            className="min-w-[48px] h-12 rounded-xl text-sm font-bold bg-gray-100 text-gray-500 hover:bg-gray-200 border border-dashed border-gray-300"
          >
            +
          </button>
        )}
      </div>
    </div>
  );
}

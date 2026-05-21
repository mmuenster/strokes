export default function HoleNav({ holes, activeHoleId, onSelect, onAddHole }) {
  // Up to 9 holes: single row. 10-18: two rows of 9. Always show + button in same grid.
  const total = holes.length + (holes.length < 18 ? 1 : 0); // holes + add button
  const cols = total <= 9 ? total : 9;

  const allItems = [
    ...holes.map(h => ({ type: 'hole', hole: h })),
    ...(holes.length < 18 ? [{ type: 'add' }] : []),
  ];

  return (
    <div
      className="grid gap-1.5"
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
    >
      {allItems.map((item, i) =>
        item.type === 'add' ? (
          <button
            key="add"
            onClick={onAddHole}
            className="h-12 rounded-xl text-sm font-bold bg-gray-100 text-gray-500 hover:bg-gray-200 border border-dashed border-gray-300"
          >
            +
          </button>
        ) : (
          <button
            key={item.hole.id}
            onClick={() => onSelect(item.hole.id)}
            className={`h-12 rounded-xl text-sm font-bold transition-colors ${
              item.hole.id === activeHoleId
                ? 'bg-green-600 text-white'
                : 'bg-white text-gray-700 border border-gray-200 hover:border-green-400'
            }`}
          >
            <div>{item.hole.number}</div>
            <div className="text-[10px] opacity-75">P{item.hole.par}</div>
          </button>
        )
      )}
    </div>
  );
}

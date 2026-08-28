export default function SortableHeader({ label, sortKey, activeSort, sortDir, onSort }) {
  const active = activeSort === sortKey;

  return (
    <th>
      <button
        type="button"
        className={`sort-header${active ? ' sort-active' : ''}`}
        onClick={() => onSort(sortKey)}
      >
        {label}
        <span className="sort-indicator" aria-hidden="true">
          {active ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ' ↕'}
        </span>
      </button>
    </th>
  );
}

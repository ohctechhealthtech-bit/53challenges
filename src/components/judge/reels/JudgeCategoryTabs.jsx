// Category pills above the judging list.
const categoryLabel = (c) => (c || '').replace(/[-_]/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());

export default function JudgeCategoryTabs({ categories = [], value, onChange }) {
  const tabs = ['all', ...categories];
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {tabs.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          className={`whitespace-nowrap rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 ${
            value === c
              ? 'border-orange-600 bg-orange-600 text-white'
              : 'border-stone-300 bg-white text-stone-600 hover:border-orange-400'
          }`}
        >
          {c === 'all' ? 'All Categories' : categoryLabel(c)}
        </button>
      ))}
    </div>
  );
}
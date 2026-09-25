/** Shared sub-tab strip used inside dashboard tabs. */
export default function SubTabs({ tabs, active, onChange }) {
  return (
    <div className="flex flex-wrap gap-1 border-b border-slate-200 pb-2">
      {tabs.map((t) => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors ${
            active === t.key ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          {t.icon && <t.icon className="h-4 w-4" />} {t.label}
        </button>
      ))}
    </div>
  );
}
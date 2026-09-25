/**
 * Tab bar for the host workspace.
 */
export default function WorkspaceTabs({ tabs, active, onChange }) {
  return (
    <div className="mb-8 flex flex-wrap gap-1 rounded-2xl border border-border bg-card p-1.5" role="tablist">
      {tabs.map((t) => (
        <button
          key={t.key}
          type="button"
          role="tab"
          aria-selected={active === t.key}
          onClick={() => onChange(t.key)}
          className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-semibold transition-colors ${
            active === t.key ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          {t.label}
          {t.badge > 0 && (
            <span className="rounded-full bg-amber-500/20 px-1.5 text-[10px] font-bold text-amber-300">{t.badge}</span>
          )}
        </button>
      ))}
    </div>
  );
}
export const ADMIN_TABS = [
  { key: 'requests', label: 'Host requests' },
  { key: 'approvals', label: 'Content approvals' },
  { key: 'challenges', label: 'All challenges' },
  { key: 'judges', label: 'Judge roster' },
  { key: 'masters', label: 'Masters & packages' },
  { key: 'stage', label: 'Stage & config' },
  { key: 'entries', label: 'Entries' },
  { key: 'scoring', label: 'Judge scoring' },
  { key: 'results', label: 'Results' },
  { key: 'votes', label: 'Votes' },
  { key: 'panel', label: 'Judge panel' },
  { key: 'exclusions', label: 'Exclusions' },
  { key: 'funds', label: 'Funds' },
  { key: 'sponsors', label: 'Sponsors' },
  { key: 'stats', label: 'Stats' },
  { key: 'branding', label: 'Branding' },
];

// Tabs that work against one selected challenge.
export const CHALLENGE_SCOPED = new Set(['entries', 'scoring', 'results', 'votes', 'panel', 'stage', 'funds', 'stats']);

export default function AdminTabStrip({ tab, counts, onChange }) {
  return (
    <div className="mt-6 flex flex-wrap gap-1 rounded-xl border border-border bg-card p-1">
      {ADMIN_TABS.map((t) => {
        const active = tab === t.key;
        const count = counts?.[t.key];
        return (
          <button
            key={t.key}
            onClick={() => onChange(t.key)}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors ${active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}
          >
            {t.label}
            {count > 0 && (
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${active ? 'bg-white/25 text-white' : 'bg-primary text-primary-foreground'}`}>
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
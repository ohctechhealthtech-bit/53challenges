/** Entry status split (pending / approved / rejected) with simple bars. */
const ROWS = [
  { key: 'pending', label: 'Awaiting review', bar: 'bg-gold' },
  { key: 'approved', label: 'Approved', bar: 'bg-success' },
  { key: 'rejected', label: 'Rejected', bar: 'bg-destructive' },
];

export default function EntryStatusBreakdown({ counts, total }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <h2 className="font-heading text-lg font-bold">Entry status</h2>
      <div className="mt-4 space-y-4">
        {ROWS.map((r) => {
          const n = counts[r.key] || 0;
          const pct = total ? Math.round((n / total) * 100) : 0;
          return (
            <div key={r.key}>
              <div className="flex items-center justify-between text-sm">
                <span className="font-semibold">{r.label}</span>
                <span className="text-muted-foreground">{n} ({pct}%)</span>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
                <div className={`h-full rounded-full ${r.bar}`} style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>
      {!total ? <p className="mt-4 text-sm text-muted-foreground">No entries yet.</p> : null}
    </div>
  );
}
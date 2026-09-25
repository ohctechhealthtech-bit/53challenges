export default function CategoryActivityTable({ rows = [] }) {
  const max = Math.max(1, ...rows.map((r) => r.entries));
  return (
    <section className="mt-8">
      <h2 className="text-lg font-bold">Activity by category</h2>
      <div className="mt-3 space-y-2">
        {rows.length === 0 && <p className="text-sm text-muted-foreground">No category activity yet.</p>}
        {rows.map((r) => (
          <div key={r.category} className="rounded-xl border border-border bg-card p-3">
            <div className="flex items-baseline justify-between gap-3">
              <p className="font-semibold">{r.category}</p>
              <p className="text-sm text-muted-foreground">
                {r.entries} entries · {r.challenges} challenges · avg {r.avgPerChallenge}
              </p>
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full grad-bg" style={{ width: `${(r.entries / max) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
export default function AudiencePanel({ audience }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <h3 className="font-heading text-lg font-bold">Audience (EOI)</h3>
      <div className="mt-2 flex flex-wrap gap-4 text-sm text-muted-foreground">
        <span>Total <b className="text-foreground">{audience.total}</b></span>
        <span>Active <b className="text-foreground">{audience.active}</b></span>
        <span>Unsubscribed <b className="text-foreground">{audience.unsubscribed}</b></span>
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <MiniList title="By audience type" rows={audience.byType} />
        <MiniList title="By source" rows={audience.bySource} />
        <MiniList title="By state" rows={audience.byState} />
        <MiniList title="By interest" rows={audience.byCategory} />
      </div>
    </div>
  );
}

function MiniList({ title, rows }) {
  return (
    <div>
      <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">{title}</p>
      <ul className="space-y-1 text-sm">
        {(rows || []).slice(0, 6).map((r, i) => <li key={i} className="flex justify-between"><span>{r.label}</span><span className="text-muted-foreground">{r.count}</span></li>)}
        {!(rows || []).length && <li className="text-muted-foreground">—</li>}
      </ul>
    </div>
  );
}
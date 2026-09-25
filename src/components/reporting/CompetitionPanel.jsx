export default function CompetitionPanel({ byCompetition, byState }) {
  const max = (byState[0]?.count) || 1;
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <h3 className="font-heading text-lg font-bold">Entries by competition</h3>
      <ol className="mt-3 space-y-1.5 text-sm">
        {byCompetition.map((c) => (
          <li key={c.id} className="flex items-center justify-between gap-3"><span className="truncate">{c.title}</span><span className="shrink-0 font-semibold">{c.count} · {c.votes}v</span></li>
        ))}
        {!byCompetition.length && <li className="text-muted-foreground">No entries.</li>}
      </ol>
      <h3 className="mt-5 font-heading text-lg font-bold">Entries by state</h3>
      <div className="mt-3 space-y-1.5">
        {byState.map((s) => (
          <div key={s.state}>
            <div className="flex justify-between text-xs"><span>{s.state}</span><span className="text-muted-foreground">{s.count}</span></div>
            <div className="mt-1 h-2 rounded bg-muted"><div className="h-2 rounded grad-bg" style={{ width: `${Math.max(4, (s.count / max) * 100)}%` }} /></div>
          </div>
        ))}
        {!byState.length && <p className="text-sm text-muted-foreground">No data.</p>}
      </div>
    </div>
  );
}
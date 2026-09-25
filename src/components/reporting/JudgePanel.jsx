export default function JudgePanel({ judges, consistency }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <h3 className="font-heading text-lg font-bold">Judge statistics</h3>
        {consistency != null && <span className="text-xs text-muted-foreground">Panel consistency: <b className="text-foreground">σ {consistency}</b></span>}
      </div>
      <table className="mt-3 w-full text-sm">
        <thead className="text-left text-xs uppercase text-muted-foreground"><tr><th className="py-1">Judge</th><th className="py-1 text-right">Scored</th><th className="py-1 text-right">Avg turnaround</th></tr></thead>
        <tbody className="divide-y divide-border">
          {judges.map((j, i) => (
            <tr key={i}><td className="py-2">{j.judge}</td><td className="py-2 text-right">{j.scored}</td><td className="py-2 text-right">{j.avgTurnaroundHours != null ? `${j.avgTurnaroundHours}h` : '—'}</td></tr>
          ))}
        </tbody>
      </table>
      {!judges.length && <p className="text-sm text-muted-foreground">No scores recorded yet.</p>}
    </div>
  );
}
const LABEL = { new: 'New', in_discussion: 'In discussion', confirmed: 'Confirmed', live: 'Live' };
const COLOR = { new: 'bg-slate-400', in_discussion: 'bg-amber-400', confirmed: 'bg-sky-400', live: 'bg-emerald-400' };

export default function PipelinePanel({ pipeline }) {
  const max = Math.max(1, ...pipeline.map((p) => p.count));
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <h3 className="font-heading text-lg font-bold">Sponsor pipeline</h3>
      <div className="mt-4 space-y-3">
        {pipeline.map((p) => (
          <div key={p.status}>
            <div className="flex justify-between text-sm"><span>{LABEL[p.status]}</span><span className="text-muted-foreground">{p.count}</span></div>
            <div className="mt-1 h-2.5 rounded bg-muted"><div className={`h-2.5 rounded ${COLOR[p.status]}`} style={{ width: `${(p.count / max) * 100}%` }} /></div>
          </div>
        ))}
      </div>
    </div>
  );
}
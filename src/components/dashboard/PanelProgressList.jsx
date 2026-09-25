import { Gavel } from 'lucide-react';

export default function PanelProgressList({ progress }) {
  if (!progress.length) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card/50 px-6 py-10 text-center text-sm text-muted-foreground">
        No judging panels yet.
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {progress.map((p) => {
        const pct = p.allocated ? Math.round((p.done / p.allocated) * 100) : 0;
        return (
          <div key={p.id} className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-start justify-between gap-2">
              <p className="flex items-center gap-1.5 font-bold leading-tight"><Gavel className="h-4 w-4 shrink-0 text-primary" /> {p.title}</p>
              <span className="shrink-0 rounded-md bg-primary/15 px-2 py-0.5 text-xs font-semibold capitalize text-primary">{p.status}</span>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">{p.judges} judges · {p.done}/{p.allocated} assessments complete</p>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-border">
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
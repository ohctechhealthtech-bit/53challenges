import { CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react';

/** Large "needs your attention" tiles, busiest first. */
export default function AttentionTiles({ queues = [], loading, error, onRetry, onOpen }) {
  if (loading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-28 animate-pulse rounded-2xl border border-border bg-card" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-destructive/40 bg-destructive/10 px-6 py-8 text-center">
        <AlertTriangle className="mx-auto h-8 w-8 text-destructive" />
        <p className="mt-3 font-heading text-lg font-bold">We couldn't load your queues</p>
        <p className="mt-1 text-sm text-muted-foreground">{error}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            <RefreshCw className="h-4 w-4" /> Try again
          </button>
        )}
      </div>
    );
  }

  const sorted = [...queues].sort((a, b) => b.count - a.count);
  const total = sorted.reduce((n, q) => n + q.count, 0);

  if (total === 0) {
    return (
      <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 px-6 py-10 text-center">
        <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-400" />
        <p className="mt-3 font-heading text-xl font-bold">All caught up</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Nothing is waiting on you right now — every queue is empty.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {sorted.map((q) => {
        const busy = q.count > 0;
        return (
          <button
            key={q.key}
            data-queue={q.key}
            onClick={() => onOpen(q)}
            className={`min-w-0 rounded-2xl border p-4 text-left transition-colors ${
              busy
                ? 'border-primary/50 bg-primary/10 hover:bg-primary/15'
                : 'border-border bg-card opacity-60 hover:opacity-100'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <p className={`text-3xl font-extrabold ${busy ? 'text-primary' : 'text-muted-foreground'}`}>{q.count}</p>
              {busy && (
                <span className="rounded-full bg-primary px-2 py-0.5 text-[11px] font-bold text-primary-foreground">
                  {q.count} waiting
                </span>
              )}
            </div>
            <p className="mt-2 break-words font-semibold">{q.label}</p>
            <p className="mt-0.5 break-words text-xs text-muted-foreground">{q.hint}</p>
          </button>
        );
      })}
    </div>
  );
}
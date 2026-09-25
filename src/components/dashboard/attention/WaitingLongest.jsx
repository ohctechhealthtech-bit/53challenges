import { Clock } from 'lucide-react';

function waited(since) {
  const ms = Date.now() - new Date(since).getTime();
  const days = Math.floor(ms / 86400000);
  if (days >= 1) return `${days} day${days === 1 ? '' : 's'}`;
  const hours = Math.floor(ms / 3600000);
  if (hours >= 1) return `${hours} hour${hours === 1 ? '' : 's'}`;
  const mins = Math.max(1, Math.floor(ms / 60000));
  return `${mins} min${mins === 1 ? '' : 's'}`;
}

/** Oldest items across every queue, so nothing quietly ages out. */
export default function WaitingLongest({ items = [], onOpen }) {
  if (items.length === 0) return null;

  return (
    <section className="mt-8 rounded-2xl border border-border bg-card p-5">
      <h2 className="flex items-center gap-2 font-heading text-lg font-bold">
        <Clock className="h-5 w-5 text-muted-foreground" aria-hidden="true" /> Waiting the longest
      </h2>
      <ul className="mt-4 divide-y divide-border">
        {items.map((i) => (
          <li key={`${i.queue}-${i.id}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-3">
            <span className="rounded-lg bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
              {i.type}
            </span>
            <span className="min-w-0 flex-1 break-words text-sm font-semibold">{i.name}</span>
            <span className="text-xs text-muted-foreground">{waited(i.since)}</span>
            <button
              onClick={() => onOpen(i)}
              className="text-xs font-bold text-primary hover:underline"
            >
              Open
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
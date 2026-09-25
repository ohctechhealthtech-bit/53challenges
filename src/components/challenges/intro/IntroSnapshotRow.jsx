import { Trophy, Users, CalendarDays, Ticket } from 'lucide-react';

/** Four-up snapshot: prize, eligibility, deadline and entry cost. */
export default function IntroSnapshotRow({ items }) {
  const icons = { prize: Trophy, who: Users, deadline: CalendarDays, entry: Ticket };
  const tints = {
    prize: 'bg-amber-500/15 text-amber-400',
    who: 'bg-purple-500/15 text-purple-400',
    deadline: 'bg-blue-500/15 text-blue-400',
    entry: 'bg-emerald-500/15 text-emerald-400',
  };

  return (
    <div className="container-tight mt-6">
      <div className="grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
        {items.map((it) => {
          const Icon = icons[it.key];
          return (
            <div key={it.key} className="flex items-center gap-3 bg-card p-5">
              <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${tints[it.key]}`}>
                <Icon className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{it.label}</p>
                <p className="truncate font-heading text-base font-bold">{it.value}</p>
                {it.hint && <p className="truncate text-xs text-muted-foreground">{it.hint}</p>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
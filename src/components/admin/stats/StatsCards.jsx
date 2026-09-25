import { num } from './statsMeta';

export default function StatsCards({ cards = [] }) {
  if (cards.length === 0) return null;
  return (
    <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((c) => (
        <div key={c.key} className="rounded-2xl border border-border bg-card/60 p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{c.label}</p>
          <p className="mt-2 font-heading text-3xl font-bold">{num(c.value)}</p>
        </div>
      ))}
    </div>
  );
}
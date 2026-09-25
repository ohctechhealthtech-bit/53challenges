import { num, titleCase } from './statsMeta';

// One labelled bar list, e.g. entries by division.
export default function StatsBreakdown({ title, rows = [] }) {
  const top = Math.max(1, ...rows.map((r) => Number(r.count) || 0));
  return (
    <div className="rounded-2xl border border-border bg-card/60 p-5">
      <p className="font-heading text-sm font-bold">{title}</p>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">Nothing recorded yet.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {rows.map((r) => (
            <li key={r.name}>
              <div className="flex items-baseline justify-between text-sm">
                <span>{titleCase(r.name)}</span>
                <span className="font-semibold">{num(r.count)}</span>
              </div>
              <div className="mt-1.5 h-2 rounded-full bg-muted">
                <div
                  className="h-2 rounded-full bg-primary"
                  style={{ width: `${Math.max(2, ((Number(r.count) || 0) / top) * 100)}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
import { num } from './statsMeta';

export default function NeedsAttentionList({ items = [] }) {
  if (items.length === 0) return null;
  return (
    <div className="mt-6 rounded-2xl border border-border bg-card/60 p-5">
      <p className="font-heading text-sm font-bold">Needs your attention</p>
      <ul className="mt-3 space-y-2">
        {items.map((i) => (
          <li key={i.label} className="flex items-center justify-between gap-4 text-sm">
            <span>{i.label}</span>
            <span className="rounded-full bg-primary/15 px-2.5 py-0.5 text-xs font-semibold text-primary">{num(i.count)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
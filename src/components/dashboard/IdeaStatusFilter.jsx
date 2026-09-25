/** Status filter chips (with counts) for the idea submissions queue. */
import { IDEA_STATUS_OPTIONS } from '@/components/dashboard/ideaLabels';

export default function IdeaStatusFilter({ value, onChange, counts, total }) {
  const chips = [{ value: 'all', label: 'All', count: total }].concat(
    IDEA_STATUS_OPTIONS.map((o) => ({ ...o, count: counts[o.value] || 0 })),
  );

  return (
    <div className="flex flex-wrap gap-2">
      {chips.map((c) => {
        const active = value === c.value;
        return (
          <button
            key={c.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(c.value)}
            className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-bold transition-colors ${
              active
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border text-muted-foreground hover:border-primary hover:text-primary'
            }`}
          >
            {c.label}
            <span className={`rounded-full px-1.5 text-[11px] ${active ? 'bg-white/25' : 'bg-muted'}`}>
              {c.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
/** One-click status buttons for an idea submission. */
import { IDEA_STATUS_OPTIONS } from '@/components/dashboard/ideaLabels';

export default function IdeaStatusButtons({ value, onChange, disabled }) {
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Submission status">
      {IDEA_STATUS_OPTIONS.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            disabled={disabled}
            aria-pressed={active}
            onClick={() => !active && onChange(o.value)}
            className={`rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors disabled:opacity-50 ${
              active
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border text-muted-foreground hover:border-primary hover:text-primary'
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
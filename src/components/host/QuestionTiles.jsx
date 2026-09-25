/**
 * D8 — Host Experience Principles.
 * Rules applied: D8.2 (visual answer tiles, not form fields), D8.7 (Recommended badge).
 */
import { Check } from 'lucide-react';
import RecommendedBadge from '@/components/host/RecommendedBadge';

export default function QuestionTiles({ options, value, onChange, multi = false, recommended }) {
  const selected = multi ? value || [] : value;
  const isSelected = (v) => (multi ? selected.includes(v) : selected === v);
  const isRecommended = (v) =>
    multi ? (recommended || []).includes(v) : recommended === v;

  const toggle = (v) => {
    if (multi) {
      onChange(selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v]);
    } else {
      onChange(v);
    }
  };

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" role={multi ? 'group' : 'radiogroup'}>
      {options.map((opt) => {
        const Icon = opt.icon;
        const active = isSelected(opt.value);
        return (
          <button
            key={opt.value}
            type="button"
            role={multi ? 'checkbox' : 'radio'}
            aria-checked={active}
            onClick={() => toggle(opt.value)}
            className={`relative flex flex-col items-start gap-2 rounded-2xl p-4 text-left transition-all ${
              active
                ? 'border-2 border-[#1677C8] bg-blue-50 text-[#102A43]'
                : 'border border-border bg-card hover:border-primary/50'
            }`}
          >
            {active && (
              <Check className="absolute right-3 top-3 h-4 w-4 text-[#1677C8]" aria-hidden="true" />
            )}
            <div className="flex w-full items-start justify-between gap-2 pr-6">
              {Icon && <Icon className={`h-6 w-6 ${active ? 'text-[#1677C8]' : 'text-muted-foreground'}`} aria-hidden="true" />}
              {isRecommended(opt.value) && <RecommendedBadge />}
            </div>
            <span className="font-heading text-sm font-bold">{opt.label}</span>
            {opt.description && (
              <span className={`text-xs leading-relaxed ${active ? 'text-slate-600' : 'text-muted-foreground'}`}>{opt.description}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
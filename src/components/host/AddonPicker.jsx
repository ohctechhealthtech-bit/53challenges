/**
 * D8 — Host Experience Principles.
 * Rules applied: D8.1 (services named in plain language), D8.7 (recommended defaults badged).
 * Scrollable list of optional services with their price — driven by the live
 * services list from the platform, nothing hard-coded in the UI.
 */
import { Check, Loader2 } from 'lucide-react';
import RecommendedBadge from '@/components/host/RecommendedBadge';
import useHostServices from '@/hooks/useHostServices';

export default function AddonPicker({ value = [], onChange, recommended = [] }) {
  const { services, loading, error } = useHostServices();

  const toggle = (key) =>
    onChange(value.includes(key) ? value.filter((k) => k !== key) : [...value, key]);

  if (loading) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-border bg-card py-10">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }

  if (error || services.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No optional services are available right now — you can add them later from your workspace.
      </p>
    );
  }

  return (
    <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
      {services.map((a) => {
        const active = value.includes(a.key);
        return (
          <button
            key={a.key}
            type="button"
            role="checkbox"
            aria-checked={active}
            onClick={() => toggle(a.key)}
            className={`flex w-full items-start justify-between gap-3 rounded-xl border p-4 text-left transition ${
              active
                ? 'border-2 border-[#1677C8] bg-blue-50'
                : 'border-border bg-card hover:border-primary/50'
            }`}
          >
            <span>
              <span className="flex items-center gap-2">
                <span className="block font-semibold text-[#102A43]">{a.name}</span>
                {recommended.includes(a.key) && <RecommendedBadge />}
              </span>
              {a.description && <span className="mt-0.5 block text-sm text-muted-foreground">{a.description}</span>}
            </span>
            <span className="flex shrink-0 items-center gap-2 text-sm font-medium text-slate-700">
              A${a.price?.toLocaleString?.() ?? a.price}
              {a.price_note ? ` ${a.price_note}` : ''}
              {active && <Check className="h-4 w-4 text-[#1677C8]" />}
            </span>
          </button>
        );
      })}
    </div>
  );
}
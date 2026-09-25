import { Check } from 'lucide-react';
import { ENTRY_TYPE_OPTIONS } from '@/components/challenges/entryTypes';

export default function EntryTypeMultiSelect({ value = [], onChange }) {
  const selected = Array.isArray(value) ? value : [];
  const toggle = (v) => onChange(selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v]);

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {ENTRY_TYPE_OPTIONS.map((o) => {
        const on = selected.includes(o.value);
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => toggle(o.value)}
            aria-pressed={on}
            className={`flex items-start gap-2 rounded-lg border p-3 text-left text-sm transition ${
              on ? 'border-primary bg-primary/5' : 'border-border bg-card hover:border-primary/50'
            }`}
          >
            <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
              on ? 'border-primary bg-primary text-primary-foreground' : 'border-stone-300'
            }`}>
              {on && <Check className="h-3 w-3" />}
            </span>
            <span>
              <span className="block font-semibold">{o.label}</span>
              <span className="block text-xs text-muted-foreground">{o.desc}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
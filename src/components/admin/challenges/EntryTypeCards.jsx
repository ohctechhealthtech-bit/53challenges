import { Check } from 'lucide-react';
import { ENTRY_TYPE_OPTIONS } from '@/components/challenges/entryTypes';

const DESCRIPTIONS = Object.fromEntries(ENTRY_TYPE_OPTIONS.map((o) => [o.value, o.desc]));

// Card-style picker for accepted entry types. The options are the parent's
// own reference list — the values saved have to be the ones the parent
// accepts — with a description added wherever this app knows the type.
export default function EntryTypeCards({ options = [], values = [], disabled, onChange }) {
  const list = options.length ? options : ENTRY_TYPE_OPTIONS.map((o) => ({ value: o.value, label: o.label }));
  const toggle = (v) => onChange(values.includes(v) ? values.filter((x) => x !== v) : [...values, v]);

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {list.map((o) => {
        const value = o.value ?? o;
        const label = o.label ?? String(o).replace(/_/g, ' ');
        const on = values.includes(value);
        return (
          <button
            key={value}
            type="button"
            disabled={disabled}
            onClick={() => toggle(value)}
            aria-pressed={on}
            className={'flex items-start gap-2 rounded-lg border p-3 text-left text-sm transition disabled:cursor-not-allowed disabled:opacity-50 ' + (on ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50')}
          >
            <span className={'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ' + (on ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/50')}>
              {on && <Check className="h-3 w-3" />}
            </span>
            <span>
              <span className="block font-semibold capitalize">{label}</span>
              {DESCRIPTIONS[value] && <span className="block text-xs text-muted-foreground">{DESCRIPTIONS[value]}</span>}
            </span>
          </button>
        );
      })}
    </div>
  );
}

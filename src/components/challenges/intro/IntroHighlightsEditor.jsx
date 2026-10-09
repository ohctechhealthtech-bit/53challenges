import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ICON_KEYS, iconFor } from './introIcons';

// Edits intro.highlights: [{ icon, title, text }]. Only icons the intro page
// can draw are offered.
export default function IntroHighlightsEditor({ value = [], onChange, disabled }) {
  const update = (i, patch) => onChange(value.map((h, idx) => (idx === i ? { ...h, ...patch } : h)));

  return (
    <div className="space-y-3">
      {value.map((h, i) => {
        const Icon = iconFor(h.icon);
        return (
          <div key={i} className="space-y-2 rounded-lg border border-border p-3">
            <div className="flex items-center gap-2">
              <Icon className="h-4 w-4 shrink-0 text-primary" />
              <select
                aria-label="Icon"
                className="c53-input w-36"
                disabled={disabled}
                value={h.icon || 'sparkles'}
                onChange={(e) => update(i, { icon: e.target.value })}
              >
                {ICON_KEYS.map((k) => <option key={k} value={k}>{k}</option>)}
              </select>
              <input
                className="c53-input flex-1"
                placeholder="Highlight title e.g. Win $500"
                disabled={disabled}
                value={h.title || ''}
                onChange={(e) => update(i, { title: e.target.value })}
              />
              <Button type="button" variant="ghost" size="icon" disabled={disabled} className="h-8 w-8 text-destructive" aria-label="Remove highlight" onClick={() => onChange(value.filter((_, idx) => idx !== i))}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            <textarea
              rows={2}
              className="c53-input"
              placeholder="One or two sentences that make it irresistible…"
              disabled={disabled}
              value={h.text || ''}
              onChange={(e) => update(i, { text: e.target.value })}
            />
          </div>
        );
      })}
      <Button type="button" variant="outline" size="sm" className="gap-2" disabled={disabled} onClick={() => onChange([...value, { icon: 'sparkles', title: '', text: '' }])}>
        <Plus className="h-4 w-4" /> Add highlight card
      </Button>
    </div>
  );
}

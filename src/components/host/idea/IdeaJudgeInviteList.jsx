/** Lets the host list the people they'd like to invite as judges. */
import { Plus, Trash2 } from 'lucide-react';

export default function IdeaJudgeInviteList({ judges, onChange }) {
  const update = (i, key, value) =>
    onChange(judges.map((j, idx) => (idx === i ? { ...j, [key]: value } : j)));

  return (
    <div className="mt-5 space-y-3">
      <p className="text-sm font-semibold">Who would you like to invite as judges?</p>
      <p className="text-xs text-muted-foreground">
        We&rsquo;ll email each person an invitation. They accept and submit their scores from their own
        judge account — scores can never be entered on their behalf.
      </p>

      {judges.map((j, i) => (
        <div key={i} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <input
            className="c53-input"
            aria-label={`Judge ${i + 1} name`}
            value={j.name}
            onChange={(e) => update(i, 'name', e.target.value)}
            placeholder="Judge name"
          />
          <input
            className="c53-input"
            aria-label={`Judge ${i + 1} email`}
            value={j.email}
            onChange={(e) => update(i, 'email', e.target.value)}
            placeholder="judge@example.com"
          />
          <button
            type="button"
            onClick={() => onChange(judges.filter((_, idx) => idx !== i))}
            className="inline-flex items-center justify-center rounded-xl border border-border px-3 py-2 text-sm font-bold transition-colors hover:border-destructive hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
            <span className="sr-only">Remove judge {i + 1}</span>
          </button>
        </div>
      ))}

      <button
        type="button"
        onClick={() => onChange([...judges, { name: '', email: '' }])}
        className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-bold transition-colors hover:border-primary hover:text-primary"
      >
        <Plus className="h-4 w-4" /> Add a judge
      </button>
    </div>
  );
}
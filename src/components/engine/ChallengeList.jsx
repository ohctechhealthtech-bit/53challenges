import { STATUS_LABELS } from '@/lib/challengeEngine';
import ContentTypeBadge from '@/components/ContentTypeBadge';

const BADGE = {
  draft: 'bg-muted text-muted-foreground',
  active: 'bg-emerald-500/15 text-emerald-400',
  voting: 'bg-primary/15 text-primary',
  completed: 'bg-sky-500/15 text-sky-400',
  archived: 'bg-muted text-muted-foreground',
};

export default function ChallengeList({ challenges, selectedId, onSelect }) {
  if (!challenges.length) {
    return <p className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">No challenges yet. Create your first one.</p>;
  }
  return (
    <ul className="space-y-2">
      {challenges.map((c) => (
        <li key={c.id}>
          <button
            onClick={() => onSelect(c)}
            className={`w-full rounded-xl border p-3 text-left transition ${String(selectedId) === String(c.id) ? 'border-primary bg-primary/5' : 'border-border bg-card hover:border-primary/40'}`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-sm font-semibold">{c.title || c.theme}</span>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${BADGE[c.status] || BADGE.draft}`}>
                {STATUS_LABELS[c.status] || c.status}
              </span>
            </div>
            <p className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
              <span className="truncate">{c.category}{c.state ? ` · ${c.state}` : ''}{c.season ? ` · ${c.season}` : ''}</span>
              <ContentTypeBadge value={c.content_type} />
            </p>
          </button>
        </li>
      ))}
    </ul>
  );
}
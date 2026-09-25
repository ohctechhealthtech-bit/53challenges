/**
 * Host-facing picker of judges from our panel.
 */
import { useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import JudgePreviewDialog from '@/components/host/apply/JudgePreviewDialog';
import JudgeAvatar from '@/components/host/apply/JudgeAvatar';
import { prettyWords } from '@/lib/hostPortalJudges';

export default function PlatformJudgePicker({ judges, loading, error, selected, onToggle }) {
  const [query, setQuery] = useState('');
  const [preview, setPreview] = useState(null);
  const q = query.toLowerCase();
  const list = (judges || []).filter((j) =>
    (j.name || '').toLowerCase().includes(q) || (j.disciplines || []).join(' ').toLowerCase().includes(q)
  );

  if (loading) return <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;
  if (error) return <p className="text-sm text-muted-foreground">{error}</p>;
  if ((judges || []).length === 0) return <p className="text-sm text-muted-foreground">We'll appoint suitable judges for you.</p>;

  return (
    <div>
      <label htmlFor="judge-search" className="mb-1 block text-sm font-semibold">Search our judges</label>
      <input id="judge-search" className="c53-input" placeholder="Name or area of expertise" value={query} onChange={(e) => setQuery(e.target.value)} />
      <p className="mt-2 text-xs text-muted-foreground">Optional — pick anyone you'd like on your panel, or leave it to us.</p>
      <div className="mt-3 grid max-h-[360px] gap-2 overflow-y-auto pr-1">
        {list.map((j) => {
          const active = selected.includes(j.id);
          const location = [j.city, j.state].filter(Boolean).join(', ');
          const works = j.works_count > 0 ? `${j.works_count} portfolio item${j.works_count === 1 ? '' : 's'}` : '';
          const third = [location, works].filter(Boolean).join(' · ');
          const openPreview = (e) => { e.stopPropagation(); setPreview(j); };
          return (
            <button
              key={j.id}
              type="button"
              role="checkbox"
              aria-checked={active}
              onClick={() => onToggle(j.id)}
              className={`flex items-start gap-3 rounded-xl border p-3 text-left transition ${active ? 'border-primary bg-primary/5' : 'border-border bg-card hover:border-primary/50'}`}
            >
              <JudgeAvatar judge={j} />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">{j.name}</span>
                <span className="block text-xs text-muted-foreground">
                  {j.level ? `${prettyWords(j.level)} level · ` : ''}{(j.disciplines || []).map(prettyWords).join(', ') || 'General'}
                </span>
                {third && <span className="block text-xs text-muted-foreground/80">{third}</span>}
                <span
                  role="link"
                  tabIndex={0}
                  onClick={openPreview}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openPreview(e); } }}
                  className="mt-1 inline-block text-xs font-semibold text-primary underline underline-offset-2 hover:text-primary/80"
                >
                  View details
                </span>
              </span>
              {active && <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />}
            </button>
          );
        })}
      </div>
      <JudgePreviewDialog judge={preview} open={!!preview} onClose={() => setPreview(null)} />
    </div>
  );
}
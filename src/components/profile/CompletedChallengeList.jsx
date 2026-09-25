import { Link } from 'react-router-dom';
import { Heart, CheckCircle2, Clock } from 'lucide-react';
import { entryDate } from '@/lib/streak';

function formatDate(d) {
  return d ? d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '';
}

export default function CompletedChallengeList({ entries = [] }) {
  const sorted = [...entries].sort((a, b) => (entryDate(b)?.getTime() || 0) - (entryDate(a)?.getTime() || 0));

  return (
    <ol className="space-y-3">
      {sorted.map((e) => {
        const done = (e.status || 'pending') === 'approved';
        const votes = Number(e.community_votes ?? e.vote_count ?? 0);
        return (
          <li key={e.id} className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {e.challenge_title || 'Challenge'}
                </p>
                <h3 className="mt-1 font-heading text-lg font-bold">{e.title || 'Untitled entry'}</h3>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-semibold ${done ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>
                    {done
                      ? <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                      : <Clock className="h-3.5 w-3.5" aria-hidden="true" />}
                    {done ? 'Completed' : 'In review'}
                  </span>
                  {votes > 0 && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 font-semibold text-primary">
                      <Heart className="h-3.5 w-3.5" aria-hidden="true" /> {votes} votes
                    </span>
                  )}
                  <span className="text-muted-foreground">{formatDate(entryDate(e))}</span>
                </div>
              </div>
              {e.challenge_id && (
                <Link
                  to={`/challenges/${e.challenge_id}`}
                  className="shrink-0 rounded-lg border border-border px-3 py-2 text-xs font-medium transition hover:border-primary hover:text-primary"
                >
                  View
                </Link>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { adminChallengeApi } from '@/lib/adminChallengeApi';
import { ASSIGNMENT_LABELS, disciplineList, formatDate, levelLabel } from './judgeMeta';

// Read-only judge record from judges.get: profile, challenge assignments and
// the portfolio works linked to them.
export default function JudgeDetailDialog({ open, onOpenChange, judgeId, onEdit }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let live = true;
    setLoading(true);
    setError('');
    adminChallengeApi.getJudge({ id: judgeId })
      .then((d) => { if (live) setData(d); })
      .catch((e) => { if (live) setError(e.message); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [judgeId]);

  const judge = data?.judge;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{judge?.name || 'Judge'}</DialogTitle>
          <DialogDescription>{judge?.email || 'Loading this judge’s record…'}</DialogDescription>
        </DialogHeader>

        {error && <p className="text-sm text-destructive">{error}</p>}
        {loading && <p className="text-sm text-muted-foreground">Loading…</p>}

        {judge && (
          <div className="space-y-5">
            <dl className="grid gap-3 sm:grid-cols-3">
              <Fact label="Level" value={levelLabel(judge.level)} />
              <Fact label="Status" value={judge.active ? 'Active' : 'Inactive'} />
              <Fact label="Added" value={formatDate(judge.created_date)} />
              <div className="sm:col-span-3">
                <Fact label="Expertise" value={disciplineList(judge.disciplines?.length ? judge.disciplines : judge.categories)} />
              </div>
              {judge.bio && (
                <div className="sm:col-span-3">
                  <Fact label="About" value={judge.bio} />
                </div>
              )}
            </dl>

            <section>
              <h4 className="text-sm font-bold">Challenge assignments</h4>
              {(data.assignments || []).length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">Not on any challenge panel yet.</p>
              ) : (
                <ul className="mt-2 divide-y divide-border rounded-xl border border-border">
                  {data.assignments.map((a) => (
                    <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                      <span className="font-semibold">{a.challenge_title || a.challenge_id}</span>
                      <span className="text-xs text-muted-foreground">
                        {ASSIGNMENT_LABELS[a.status] || a.status}
                        {a.scorable_entries != null && ` · scored ${a.scored_entries ?? 0}/${a.scorable_entries}`}
                        {a.scoring_complete && ' · done'}
                        {(a.recused_categories || []).length > 0 && ` · recused: ${a.recused_categories.join(', ')}`}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section>
              <h4 className="text-sm font-bold">Portfolio</h4>
              {(data.works || []).length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">No portfolio works linked.</p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {data.works.map((w, i) => (
                    <li key={w.id || i} className="rounded-xl border border-border px-3 py-2 text-sm">
                      <div className="font-semibold">{w.title || w.name || 'Untitled work'}</div>
                      {w.description && <p className="mt-1 text-xs text-muted-foreground">{w.description}</p>}
                      {(w.url || w.link || w.file_url) && (
                        <a
                          href={w.url || w.link || w.file_url}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-1 inline-block text-xs font-semibold text-primary underline"
                        >
                          Open
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          <Button onClick={() => onEdit?.(judge)} disabled={!judge}>Edit judge</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Fact({ label, value }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm">{value || '—'}</dd>
    </div>
  );
}
import { useEffect, useState } from 'react';
import { Loader2, Gavel, CheckCircle2, ShieldAlert, Eye } from 'lucide-react';
import { loadWorkspace } from '@/lib/judgeScoring';
import ScoreSheet from '@/components/judging/ScoreSheet';

// Judge scoring console. Everything shown here comes from the protected
// judgeScoring function — only the signed-in judge's own allocations.
export default function ScoringConsole() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [active, setActive] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      setData(await loadWorkspace());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>;
  if (error) return <p className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p>;

  if (!data?.judge) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card/50 px-6 py-12 text-center">
        <Gavel className="mx-auto h-10 w-10 text-muted-foreground" />
        <p className="mt-3 text-sm text-muted-foreground">No active judge profile is linked to this account.</p>
      </div>
    );
  }

  const scoringPanels = data.panels.filter((p) => p.status === 'scoring');

  if (!scoringPanels.length) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card/50 px-6 py-12 text-center text-sm text-muted-foreground">
        No panels are open for scoring right now.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {scoringPanels.map((panel) => {
        const mine = data.assignments.filter((a) => a.panel_id === panel.id);
        const scoreFor = (entryId) => data.scores.find((s) => s.panel_id === panel.id && s.entry_id === entryId && s.status !== 'draft');
        const done = mine.filter((a) => scoreFor(a.entry_id)).length;

        return (
          <div key={panel.id} className="rounded-2xl border border-border bg-card p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="font-heading text-lg font-bold">{panel.competition_title}</h3>
                <p className="text-xs text-muted-foreground">
                  {done}/{mine.length} scored{panel.is_head_judge ? ' · You are Head Judge' : ''}
                </p>
              </div>
              <span className="rounded-md bg-primary/15 px-2.5 py-1 text-xs font-semibold capitalize text-primary">{panel.status}</span>
            </div>

            {mine.length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">No entries have been allocated to you on this panel yet.</p>
            ) : (
              <div className="mt-4 space-y-2">
                {mine.map((a) => {
                  const score = scoreFor(a.entry_id);
                  return (
                    <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-white/5 px-3 py-2.5">
                      <span className="flex items-center gap-2 text-sm font-mono">
                        {a.anonymous_id}
                        {score && <CheckCircle2 className="h-4 w-4 text-emerald-400" />}
                        {score?.compliance_flagged && (
                          <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/15 px-2 py-0.5 font-sans text-xs font-bold text-amber-400">
                            <ShieldAlert className="h-3 w-3" /> Flagged
                          </span>
                        )}
                      </span>
                      {score ? (
                        <span className="text-xs text-muted-foreground">Submitted</span>
                      ) : (
                        <button onClick={() => setActive({ panel, assignment: a })}
                          className="inline-flex items-center gap-1.5 rounded-lg grad-bg px-3 py-1.5 text-xs font-bold text-white">
                          <Eye className="h-3.5 w-3.5" /> Score entry
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {active && (
        <ScoreSheet
          panel={active.panel}
          assignment={active.assignment}
          onClose={() => setActive(null)}
          onSubmitted={() => { setActive(null); load(); }}
        />
      )}
    </div>
  );
}
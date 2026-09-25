import { useEffect, useState } from 'react';
import { Loader2, Gavel, Crown, Plus, X, Check } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { challengeApi } from '@/lib/challengeApi';
import { audit, anonymousId } from '@/lib/judging';

// Panel assembly: pick competition (if new), match category to Active judges,
// select panel members, appoint a Head Judge, set status.
export default function StagePanel({ panel, onChange, actor }) {
  const [competitions, setCompetitions] = useState([]);
  const [judges, setJudges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const [chRes, jl] = await Promise.all([
          challengeApi.listChallenges({ status: 'active', limit: 200 }),
          base44.entities.JudgeProfile.filter({ status: 'active' }, '-created_date', 500),
        ]);
        setCompetitions(chRes?.challenges || []);
        setJudges(jl || []);
      } finally { setLoading(false); }
    })();
  }, []);

  const comp = competitions.find((c) => c.id === panel.competition_id);

  const toggleJudge = async (j) => {
    const has = panel.judge_profile_ids.includes(j.id);
    const ids = has ? panel.judge_profile_ids.filter((x) => x !== j.id) : [...panel.judge_profile_ids, j.id];
    setBusy(true);
    try {
      const updated = await base44.entities.JudgingPanel.update(panel.id, { judge_profile_ids: ids });
      await audit(panel.id, actor, has ? 'judge_removed' : 'judge_added', j.name);
      onChange(updated);
    } finally { setBusy(false); }
  };

  const setHead = async (j) => {
    setBusy(true);
    try {
      const updated = await base44.entities.JudgingPanel.update(panel.id, {
        head_judge_profile_id: j.id, head_judge_name: j.name,
      });
      await audit(panel.id, actor, 'head_judge_appointed', j.name);
      onChange(updated);
    } finally { setBusy(false); }
  };

  const inCategory = judges.filter((j) => !panel.competition_category || (j.approved_categories || []).includes(panel.competition_category) || (j.applied_categories || []).includes(panel.competition_category));
  const matched = inCategory.length ? inCategory : judges;

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-5">
      {comp && <div className="rounded-xl border border-border bg-card p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Competition</p>
        <p className="mt-1 font-bold">{comp.title || comp.theme}</p>
        <p className="text-xs text-muted-foreground">Category: {panel.competition_category || '—'}</p>
      </div>}

      <div>
        <div className="flex items-center gap-2"><Gavel className="h-4 w-4 text-primary" /><p className="font-semibold">{matched.length} Active judge(s) matching the category</p></div>
        {matched.length === 0 && <p className="mt-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-400">No active judges match this category. Approve judges in the Judges tab first.</p>}
        <div className="mt-3 space-y-2">
          {matched.map((j) => {
            const inPanel = panel.judge_profile_ids.includes(j.id);
            const isHead = panel.head_judge_profile_id === j.id;
            return (
              <div key={j.id} className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3 ${inPanel ? 'border-primary/50 bg-primary/5' : 'border-border bg-white/5'}`}>
                <div>
                  <p className="text-sm font-semibold">{j.name}</p>
                  <p className="text-xs text-muted-foreground">{j.email} · {j.state || '—'}</p>
                </div>
                <div className="flex items-center gap-2">
                  {isHead && <span className="inline-flex items-center gap-1 rounded-lg bg-gold/15 px-2 py-1 text-xs font-bold text-amber-400"><Crown className="h-3.5 w-3.5" /> Head</span>}
                  {!isHead && inPanel && <button onClick={() => setHead(j)} className="rounded-lg border border-border px-2 py-1 text-xs font-semibold hover:bg-muted">Make Head</button>}
                  <button onClick={() => toggleJudge(j)} className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold ${inPanel ? 'border border-destructive/40 text-destructive' : 'grad-bg text-white'}`}>
                    {inPanel ? <><X className="h-3.5 w-3.5" /> Remove</> : <><Plus className="h-3.5 w-3.5" /> Add to panel</>}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {panel.judge_profile_ids.length > 0 && (
        <button onClick={() => proceedToCalibration()} disabled={busy || !panel.head_judge_profile_id}
          className="rounded-xl grad-bg px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50">
          {panel.head_judge_profile_id ? 'Proceed to calibration' : 'Appoint a Head Judge to continue'}
        </button>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );

  async function proceedToCalibration() {
    if (!panel.head_judge_profile_id) { setError('Appoint a Head Judge first.'); return; }
    setBusy(true);
    try {
      const updated = await base44.entities.JudgingPanel.update(panel.id, { status: 'calibration' });
      await audit(panel.id, actor, 'stage_calibration_started');
      onChange(updated);
    } finally { setBusy(false); }
  }
}
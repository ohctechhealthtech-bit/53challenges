import { useEffect, useState } from 'react';
import { Loader2, Calculator, Lock, Trophy, Scale } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { computeCombinedResults, getCombinedResults } from '@/lib/votes';

// Shown after a panel is locked. Runs the combined weighted-scoring against the
// public vote, displays the public weighting, and locks results (status→complete).
export default function StageResults({ panel, onChange, actor }) {
  const [results, setResults] = useState([]);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const load = async () => {
    const { rows, map } = await getCombinedResults(panel.competition_id);
    setResults(rows || []);
    setLoaded(true);
  };
  useEffect(() => { load(); }, [panel.id, panel.competition_id]);

  const compute = async (lock) => {
    setBusy(true);
    try {
      const res = await computeCombinedResults(panel.id, lock);
      if (lock) {
        const updated = await base44.entities.JudgingPanel.update(panel.id, {
          status: 'complete', results_locked: true, results_locked_at: new Date().toISOString(),
        });
        onChange(updated);
      }
      setResults(res.results || []);
    } finally { setBusy(false); }
  };

  const jw = panel.judge_weight ?? 0.7;
  const pw = panel.public_weight ?? 0.3;

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-heading text-lg font-bold">Combined results</h3>
            <p className="text-xs text-muted-foreground">Final = {(jw * 100).toFixed(0)}% judging + {(pw * 100).toFixed(0)}% public vote. Each component normalised to 0–100.</p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-primary/15 px-3 py-1.5 text-xs font-bold text-primary">
            <Scale className="h-3.5 w-3.5" /> {panel.weighting_visible ? 'Weighting public' : 'Weighting hidden'}
          </span>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button onClick={() => compute(false)} disabled={busy} className="inline-flex items-center gap-1.5 rounded-xl grad-bg px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
            <Calculator className="h-4 w-4" /> {busy ? 'Computing…' : 'Compute combined results'}
          </button>
          {!panel.results_locked && (
            <button onClick={() => compute(true)} disabled={busy || results.length === 0} className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-sm font-bold text-emerald-400 hover:bg-emerald-500/20 disabled:opacity-50">
              <Lock className="h-4 w-4" /> Lock & publish
            </button>
          )}
          {panel.results_locked && <span className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-sm font-bold text-emerald-400"><Lock className="h-4 w-4" /> Results locked</span>}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <h4 className="flex items-center gap-2 font-semibold"><Trophy className="h-4 w-4 text-amber-400" /> Combined leaderboard</h4>
        {!loaded ? <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div> : results.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No results computed yet. Run “Compute combined results” after all scores are in.</p>
        ) : (
          <ol className="mt-3 space-y-2">
            {results.map((r) => (
              <li key={r.entry_id} className="flex items-center justify-between rounded-lg border border-border bg-white/5 px-3 py-2">
                <span className="text-sm font-semibold">{r.combined_rank}. {r.entry_id}</span>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span>Judge {r.judge_score.toFixed(1)} <span className="opacity-50">({r.judge_count}j)</span></span>
                  <span>Public {r.public_score.toFixed(1)} <span className="opacity-50">({r.public_votes}v)</span></span>
                  <span className="font-heading text-base font-extrabold text-primary">{r.combined_score.toFixed(2)}</span>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
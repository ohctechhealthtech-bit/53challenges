import { useEffect, useState } from 'react';
import { Loader2, Check, ArrowRight, Sparkles } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { audit } from '@/lib/judging';

// Calibration round: manager picks 3–5 sample entries; judges score them
// (blind, via the Judge Portal); the Head Judge sees the spread per sample.
export default function StageCalibration({ panel, onChange, actor }) {
  const [entries, setEntries] = useState([]);
  const [calScores, setCalScores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [entRes, calRes] = await Promise.all([
        base44.functions.invoke('challengeApi', { action: 'entries', challenge_id: panel.competition_id }),
        base44.entities.CalibrationScore.filter({ panel_id: panel.id }, '-created_date', 500),
      ]);
      setEntries(entRes?.data?.entries || []);
      setCalScores(calRes || []);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [panel.id]);

  const samples = panel.calibration_entry_ids || [];
  const toggleSample = async (e) => {
    const ids = samples.includes(e.id) ? samples.filter((x) => x !== e.id) : (samples.length >= 5 ? samples : [...samples, e.id]);
    setBusy(true);
    try {
      const updated = await base44.entities.JudgingPanel.update(panel.id, { calibration_entry_ids: ids });
      await audit(panel.id, actor, 'calibration_sample_changed', e.id);
      onChange(updated);
    } finally { setBusy(false); }
  };

  const proceed = async () => {
    if (samples.length < 3) return;
    setBusy(true);
    try {
      const updated = await base44.entities.JudgingPanel.update(panel.id, { status: 'scoring' });
      await audit(panel.id, actor, 'stage_scoring_started');
      onChange(updated);
    } finally { setBusy(false); }
  };

  // Spread per sample: { entryId: { judgeName: total, ... } }
  const spread = {};
  (samples).forEach((id) => { spread[id] = {}; });
  calScores.forEach((cs) => {
    if (!spread[cs.entry_id]) spread[cs.entry_id] = {};
    const total = (cs.scores || []).reduce((a, c) => a + Number(c.value || 0), 0);
    spread[cs.entry_id][cs.judge_name] = total;
  });

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-border bg-card p-4">
        <h3 className="font-heading text-lg font-bold flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /> Calibration round</h3>
        <p className="text-sm text-muted-foreground">Pick 3–5 sample entries. All judges score the same samples blind before live scoring; the Head Judge reviews the spread.</p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {entries.map((e) => {
          const on = samples.includes(e.id);
          return (
            <button key={e.id} onClick={() => toggleSample(e)} disabled={busy}
              className={`rounded-xl border p-3 text-left text-sm transition ${on ? 'border-primary bg-primary/10' : 'border-border bg-white/5 hover:bg-muted disabled:opacity-40'}`}>
              <p className="font-semibold line-clamp-1">{on ? <Check className="inline h-4 w-4 text-primary" /> : null} {e.title || 'Untitled'}</p>
              <p className="text-xs text-muted-foreground line-clamp-1">{e.creator_name || '—'}</p>
            </button>
          );
        })}
      </div>
      {entries.length === 0 && <p className="text-sm text-muted-foreground">No entries found for this competition yet.</p>}
      {samples.length > 0 && samples.length < 3 && <p className="text-xs text-amber-400">Select at least 3 samples to proceed.</p>}

      {samples.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4">
          <h4 className="font-semibold">Head Judge spread view</h4>
          <div className="mt-3 space-y-2">
            {samples.map((id) => {
              const judgeTotals = Object.entries(spread[id] || {});
              if (!judgeTotals.length) return <p key={id} className="text-xs text-muted-foreground">Sample {id.slice(0, 8)}… — awaiting scores</p>;
              const vals = judgeTotals.map(([, v]) => v);
              return (
                <div key={id} className="rounded-lg border border-border bg-white/5 p-3">
                  <p className="text-xs font-semibold text-muted-foreground">Sample</p>
                  <div className="mt-1 flex flex-wrap gap-3 text-sm">
                    {judgeTotals.map(([n, v]) => <span key={n} className="rounded-md bg-muted px-2 py-0.5">{n}: <b>{v}</b></span>)}
                    <span className="rounded-md bg-primary/15 px-2 py-0.5 text-primary">Mean {(vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1)}</span>
                    <span className="rounded-md bg-amber-500/15 px-2 py-0.5 text-amber-400">Spread {Math.max(...vals) - Math.min(...vals)}</span>
                  </div>
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">{calScores.length} calibration score(s) submitted by {Object.keys(spread).length ? 'panel' : 'no judges yet'}.</p>
        </div>
      )}

      <button onClick={proceed} disabled={busy || samples.length < 3 || calScores.length < panel.judge_profile_ids.length}
        className="inline-flex items-center gap-1.5 rounded-xl grad-bg px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50">
        <ArrowRight className="h-4 w-4" /> {calScores.length < panel.judge_profile_ids.length ? 'Awaiting all judges\' calibration' : 'Proceed to live scoring'}
      </button>
    </div>
  );
}
import { useEffect, useState } from 'react';
import { Loader2, Shuffle, Lock, AlertTriangle, Crown, History } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { audit, assignJudgesToEntries, anonymousId, finalScores, flagAnomalies, rankEntries } from '@/lib/judging';

export default function StageScoring({ panel, onChange, actor }) {
  const [entries, setEntries] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [scores, setScores] = useState([]);
  const [log, setLog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [entRes, asRes, scRes, logRes] = await Promise.all([
        base44.functions.invoke('challengeApi', { action: 'entries', challenge_id: panel.competition_id }),
        base44.entities.EntryJudgeAssignment.filter({ panel_id: panel.id }, '-assigned_at', 500),
        base44.entities.Score.filter({ panel_id: panel.id }, '-created_date', 5000),
        base44.entities.JudgingAuditLog.filter({ panel_id: panel.id }, '-created_date', 500),
      ]);
      // Only approved content is ever judged.
      setEntries((entRes?.data?.entries || []).filter((e) => String(e.status || 'approved') === 'approved'));
      setAssignments(asRes || []);
      setScores(scRes || []);
      setLog(logRes || []);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [panel.id]);

  const runAssignment = async () => {
    setBusy(true);
    try {
      // clear existing active assignments
      await base44.entities.EntryJudgeAssignment.deleteMany({ panel_id: panel.id });
      const listOfJudges = await Promise.all(panel.judge_profile_ids.map((id) => base44.entities.JudgeProfile.get(id)));
      const plan = assignJudgesToEntries(entries, listOfJudges, 3);
      const records = [];
      plan.forEach(({ entry, judges }) => {
        const aid = anonymousId(entry.id);
        judges.forEach((j) => {
          records.push({
            panel_id: panel.id,
            entry_id: entry.id,
            anonymous_id: aid,
            judge_profile_id: j.id,
            judge_name: j.name,
            blind_work_type: entry.work_type || 'text',
            blind_work_text: entry.work_text || '',
            blind_work_link: entry.work_link || '',
            assigned_at: new Date().toISOString(),
          });
        });
      });
      await base44.entities.EntryJudgeAssignment.bulkCreate(records);
      await audit(panel.id, actor, 'assignment_run', `${records.length} blind assignments`);
      await load();
    } finally { setBusy(false); }
  };

  const finals = scores.length ? finalScores(scores.filter((s) => s.status !== 'draft'), panel.criteria) : {};
  const anomalies = scores.length ? flagAnomalies(scores.filter((s) => s.status !== 'draft'), panel.criteria) : { divergentEntries: [], outlierJudges: [] };
  const { ranked, firstWeightedCriterion } = rankEntries(finals, panel.criteria);

  const lockCompetition = async () => {
    setBusy(true);
    try {
      const updated = await base44.entities.JudgingPanel.update(panel.id, { status: 'locked' });
      await audit(panel.id, actor, 'competition_locked');
      onChange(updated);
    } finally { setBusy(false); }
  };

  const orderRescore = async (entryId, reason) => {
    setBusy(true);
    try {
      // reset all submitted scores for this entry to draft (head-judge amendment)
      const entryScores = scores.filter((s) => s.entry_id === entryId && s.status !== 'draft');
      await base44.entities.Score.bulkUpdate(entryScores.map((s) => ({ id: s.id, status: 'amended', amendment_reason: reason, amended_by: panel.head_judge_profile_id })));
      await audit(panel.id, actor, 'rescore_ordered', `entry ${anonymousId(entryId)}: ${reason}`);
      await load();
    } finally { setBusy(false); }
  };

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  const assignedCount = assignments.length;
  const expectedAssignments = entries.length * 3;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-card p-4">
        <div>
          <h3 className="font-heading text-lg font-bold">Live scoring</h3>
          <p className="text-xs text-muted-foreground">{entries.length} entries · {assignedCount}/{expectedAssignments || 0} blind assignments · {scores.length} scores submitted</p>
        </div>
        <button onClick={runAssignment} disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-xl grad-bg px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
          <Shuffle className="h-4 w-4" /> {assignedCount ? 'Re-run blind assignment' : 'Run blind assignment'}
        </button>
      </div>

      {anomalies.divergentEntries.length > 0 && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4">
          <p className="flex items-center gap-2 font-semibold text-amber-400"><AlertTriangle className="h-4 w-4" /> Flagged anomalies</p>
          <ul className="mt-2 space-y-1 text-sm">
            {anomalies.divergentEntries.map((d) => (
              <li key={d.entryId}>Entry {anonymousId(d.entryId)}: spread {d.spread.toFixed(1)} across {d.judgeCount || Object.keys(d.values).length} judges</li>
            ))}
            {anomalies.outlierJudges.map((d) => (
              <li key={d.jid}>Judge {d.jid.slice(0, 6)} scoring consistently outside the panel pattern (avg deviation {d.avg.toFixed(2)}).</li>
            ))}
          </ul>
          {anomalies.divergentEntries.map((d) => (
            <button key={d.entryId} onClick={() => orderRescore(d.entryId, `Spread ${d.spread.toFixed(1)} flagged by Head Judge`)} disabled={busy}
              className="mt-2 mr-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs font-bold text-amber-400 hover:bg-amber-500/20">
              Order re-score {anonymousId(d.entryId)}
            </button>
          ))}
        </div>
      )}

      <div className="rounded-xl border border-border bg-card p-4">
        <h4 className="font-semibold flex items-center gap-2"><Crown className="h-4 w-4 text-amber-400" /> Ranked results</h4>
        <p className="text-xs text-muted-foreground">Ties resolve by highest score on “{firstWeightedCriterion || '—'}”, then Head Judge decision. Raw scores retained; shown normalised.</p>
        {ranked.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No final scores yet.</p>
        ) : (
          <ol className="mt-3 space-y-2">
            {ranked.map((r, i) => (
              <li key={r.id} className="flex items-center justify-between rounded-lg border border-border bg-white/5 px-3 py-2">
                <span className="text-sm font-semibold">{i + 1}. {anonymousId(r.id)} <span className="text-muted-foreground">({r.judgeCount} judges)</span></span>
                <span className="font-heading text-lg font-extrabold text-primary">{r.weighted.toFixed(2)}</span>
              </li>
            ))}
          </ol>
        )}
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <h4 className="font-semibold flex items-center gap-2"><History className="h-4 w-4 text-muted-foreground" /> Audit log</h4>
        <ul className="mt-2 max-h-60 space-y-1 overflow-y-auto text-xs">
          {log.length === 0 && <li className="text-muted-foreground">No actions logged yet.</li>}
          {log.map((l) => (
            <li key={l.id} className="flex justify-between gap-2 border-b border-border/40 py-1">
              <span><b>{l.action}</b> {l.detail} <span className="text-muted-foreground">· {l.actor}</span></span>
              <span className="shrink-0 text-muted-foreground">{new Date(l.at || l.created_date).toLocaleString('en-AU')}</span>
            </li>
          ))}
        </ul>
      </div>

      {panel.status === 'scoring' && (
        <button onClick={lockCompetition} disabled={busy || ranked.length === 0}
          className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-sm font-bold text-emerald-400 hover:bg-emerald-500/20 disabled:opacity-50">
          <Lock className="h-4 w-4" /> Lock results (hold for audit)
        </button>
      )}
    </div>
  );
}
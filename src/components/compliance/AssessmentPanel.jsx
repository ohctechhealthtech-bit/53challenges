import { useState } from 'react';
import { Play, Loader2, AlertTriangle, CheckCircle2, FileText } from 'lucide-react';
import { base44 } from '@/api/base44Client';

async function invoke(action, payload = {}) {
  return base44.functions.invoke('runComplianceAssessment', { action, ...payload });
}

const CLASS_COLORS = {
  game_of_skill: 'bg-emerald-500/15 text-emerald-400',
  game_of_chance: 'bg-amber-500/15 text-amber-400',
  mixed: 'bg-purple-500/15 text-purple-400',
  requires_legal_opinion: 'bg-destructive/15 text-destructive',
};

export default function AssessmentPanel() {
  const [challengeId, setChallengeId] = useState('');
  const [factsJson, setFactsJson] = useState('');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);
  const [findings, setFindings] = useState([]);
  const [error, setError] = useState('');
  const [waiving, setWaiving] = useState(null);
  const [waiverReason, setWaiverReason] = useState('');

  const runAssessment = async () => {
    if (!challengeId) return;
    setRunning(true); setError(''); setResult(null); setFindings([]);
    try {
      let factsOverride = {};
      if (factsJson.trim()) {
        try { factsOverride = JSON.parse(factsJson); } catch { setError('Invalid facts JSON'); setRunning(false); return; }
      }
      const { result: res } = await invoke('assess', { challenge_id: challengeId, facts_override: factsOverride });
      setResult(res);
      const { findings: fs } = await invoke('list_findings', { challenge_id: challengeId });
      setFindings(fs || []);
    } catch (e) {
      setError(e?.message || 'Assessment failed');
    } finally { setRunning(false); }
  };

  const waiveFinding = async (finding_id) => {
    if (!waiverReason.trim()) return;
    try {
      await invoke('waive_finding', { finding_id, waiver_reason: waiverReason });
      setWaiving(null); setWaiverReason('');
      const { findings: fs } = await invoke('list_findings', { challenge_id: challengeId });
      setFindings(fs || []);
    } catch (e) { setError(e?.message || 'Waiver failed'); }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-4">
        <h3 className="mb-3 font-heading text-sm font-bold">Run Compliance Assessment</h3>
        <input placeholder="Challenge ID" value={challengeId} onChange={(e) => setChallengeId(e.target.value)} className="c53-input" />
        <textarea
          placeholder='Optional facts override JSON, e.g. {"prize_pool":50,"prize_includes_alcohol":false}'
          value={factsJson} onChange={(e) => setFactsJson(e.target.value)}
          className="c53-input mt-2" rows={3}
        />
        <button onClick={runAssessment} disabled={running || !challengeId}
          className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
          {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />} Run Assessment
        </button>
      </div>

      {error && <div className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive" role="alert">{error}</div>}

      {result && (
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="mb-3 font-heading text-sm font-bold">Assessment Result</h3>
          <div className="flex flex-wrap items-center gap-3">
            <span className={`rounded-full px-3 py-1 text-sm font-bold ${CLASS_COLORS[result.classification] || 'bg-muted'}`}>{result.classification}</span>
            <span className="text-xs text-muted-foreground">Findings: {result.findings_total} (created: {result.findings_created})</span>
          </div>
          {result.fired_triggers?.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-semibold text-muted-foreground">Fired triggers:</p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {result.fired_triggers.map((t) => (
                  <span key={t} className="rounded-full bg-primary/15 px-2.5 py-0.5 text-xs font-semibold text-primary">{t}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {findings.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="mb-3 font-heading text-sm font-bold">Findings ({findings.length})</h3>
          <div className="space-y-2">
            {findings.map((f) => (
              <div key={f.id} className="rounded-lg bg-black/20 px-3 py-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold">{f.rule_code}</span>
                    <span className="text-xs text-muted-foreground">{f.obligation_type}</span>
                    {f.blocking && <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-xs text-destructive">blocking</span>}
                    <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs text-primary">gate: {f.gate || 'publish'}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${f.status === 'satisfied' ? 'bg-emerald-500/15 text-emerald-400' : f.status === 'waived' ? 'bg-purple-500/15 text-purple-400' : 'bg-amber-500/15 text-amber-400'}`}>{f.status}</span>
                  </div>
                  {f.status === 'open' && (
                    <button onClick={() => setWaiving(waiving === f.id ? null : f.id)}
                      className="rounded-lg bg-secondary px-3 py-1 text-xs font-semibold text-foreground">Waive</button>
                  )}
                </div>
                {f.waiver_reason && <p className="mt-1 text-xs text-muted-foreground">Waived: {f.waiver_reason}</p>}
                {f.evidence?.length > 0 && (
                  <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                    <FileText className="h-3 w-3" /> {f.evidence.length} evidence item(s)
                  </div>
                )}
                {waiving === f.id && (
                  <div className="mt-2 flex gap-2">
                    <input placeholder="Waiver reason (required)" value={waiverReason} onChange={(e) => setWaiverReason(e.target.value)} className="c53-input" />
                    <button onClick={() => waiveFinding(f.id)} className="shrink-0 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground">Confirm Waive</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
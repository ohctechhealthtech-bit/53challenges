import { useEffect, useState } from 'react';
import { ShieldCheck, Unlock, Lock, Loader2, ChevronRight, Check, X } from 'lucide-react';
import { base44 } from '@/api/base44Client';

async function invoke(action, payload = {}) {
  return base44.functions.invoke('lifecycleGate', { action, ...payload });
}

export const GATE_OPTIONS = [
  { value: 'draft_to_review', label: 'Draft → Review' },
  { value: 'review_to_approved', label: 'Review → Approved' },
  { value: 'approved_to_published', label: 'Approved → Published' },
  { value: 'entry_open', label: 'Entry Open' },
  { value: 'voting_open', label: 'Voting Open' },
];

const STATUS_STYLES = {
  passed: 'bg-emerald-500/15 text-emerald-400',
  blocked: 'bg-destructive/15 text-destructive',
  pending: 'bg-amber-500/15 text-amber-400',
};

export default function GatePanel() {
  const [challengeId, setChallengeId] = useState('');
  const [gates, setGates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [passing, setPassing] = useState(null);
  const [error, setError] = useState('');

  const loadGates = async (cid) => {
    if (!cid) return;
    setLoading(true); setError('');
    try {
      const { gates: gs } = await invoke('gate_status', { challenge_id: cid });
      setGates(gs || []);
    } catch (e) {
      setError(e?.message || 'Failed to load gate status');
    } finally { setLoading(false); }
  };

  useEffect(() => {
    if (challengeId) loadGates(challengeId);
    else setGates([]);
  }, [challengeId]);

  const handlePass = async (gate_code) => {
    setPassing(gate_code); setError('');
    try {
      await invoke('pass_gate', { challenge_id: challengeId, gate_code });
      await loadGates(challengeId);
    } catch (e) {
      setError(e?.message || 'Failed to pass gate');
    } finally { setPassing(null); }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-4">
        <h3 className="mb-3 font-heading text-sm font-bold">Lifecycle Gate Status</h3>
        <p className="mb-3 text-xs text-muted-foreground">
          Enter a challenge ID to view its stage gates. Gates check evidence-linked findings, never checkboxes.
          The interim launch_blocked logic is superseded once a challenge enters the lifecycle system.
        </p>
        <input
          placeholder="Challenge ID"
          value={challengeId}
          onChange={(e) => setChallengeId(e.target.value)}
          className="c53-input"
        />
      </div>

      {error && (
        <div className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive" role="alert">{error}</div>
      )}

      {loading ? (
        <div className="py-10 text-center text-muted-foreground">
          <Loader2 className="mx-auto h-5 w-5 animate-spin" />
        </div>
      ) : gates.length > 0 ? (
        <div className="space-y-2">
          {gates.map((g, i) => {
            const checkStatus = g.check?.status || 'pending';
            const canPass = g.evaluation?.can_pass;
            const isPassed = checkStatus === 'passed';
            return (
              <div key={g.code} className="rounded-xl border border-border bg-card p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="grid h-7 w-7 place-items-center rounded-full bg-muted text-xs font-bold text-muted-foreground">
                      {i + 1}
                    </span>
                    <div>
                      <p className="text-sm font-semibold">{g.name}</p>
                      <code className="text-xs text-muted-foreground">{g.code}</code>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLES[checkStatus] || STATUS_STYLES.pending}`}>
                      {checkStatus}
                    </span>
                    {isPassed ? (
                      <ShieldCheck className="h-4 w-4 text-emerald-400" />
                    ) : canPass ? (
                      <button
                        onClick={() => handlePass(g.code)}
                        disabled={passing === g.code}
                        className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground disabled:opacity-50"
                      >
                        {passing === g.code ? <Loader2 className="h-3 w-3 animate-spin" /> : <Unlock className="h-3 w-3" />}
                        Pass Gate
                      </button>
                    ) : (
                      <Lock className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                </div>

                {g.description && <p className="mt-2 text-xs text-muted-foreground">{g.description}</p>}

                {g.check?.passed_at && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Passed {new Date(g.check.passed_at).toLocaleString()} by {g.check.passed_by_email || '—'}
                  </p>
                )}
                {g.check?.relocked_reason && (
                  <p className="mt-1 text-xs text-destructive">Re-locked: {g.check.relocked_reason}</p>
                )}

                {g.check?.grandfathered && (
                  <p className="mt-1 text-xs font-semibold text-amber-400">Grandfathered live — preserved when the lifecycle gate system was activated.</p>
                )}

                {g.evaluation?.conditions?.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {g.evaluation.conditions.map((c, idx) => (
                      <div key={idx} className="flex items-start gap-1.5 text-xs">
                        {c.passed ? (
                          <Check className="mt-0.5 h-3 w-3 shrink-0 text-emerald-400" />
                        ) : (
                          <X className="mt-0.5 h-3 w-3 shrink-0 text-destructive" />
                        )}
                        <span className={c.passed ? 'text-muted-foreground' : 'text-foreground'}>{c.description}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : challengeId ? (
        <div className="py-10 text-center text-muted-foreground">No gate data. Seed the LifecycleGate reference data first.</div>
      ) : (
        <div className="py-10 text-center text-muted-foreground">Enter a challenge ID to view gate status.</div>
      )}
    </div>
  );
}
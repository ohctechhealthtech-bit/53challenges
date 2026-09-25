import { useEffect, useState } from 'react';
import { Loader2, Link2, Trash2, ShieldAlert } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { challengeApi } from '@/lib/challengeApi';
import { ROLE_LABELS, canAssignJudge, checkRoleSeparation, wwccLabel } from '@/lib/judges';

export default function JudgeAssignments({ onReload }) {
  const [judges, setJudges] = useState([]);
  const [competitions, setCompetitions] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const [selComp, setSelComp] = useState('');
  const [selJudge, setSelJudge] = useState('');
  const [selRole, setSelRole] = useState('judge');
  const [requiresWWCC, setRequiresWWCC] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [jl, chRes, al] = await Promise.all([
        base44.entities.JudgeProfile.filter({ status: 'active' }, '-created_date', 500),
        challengeApi.listChallenges({ status: 'active', limit: 200 }),
        base44.entities.CompetitionAssignment.list('-assigned_at', 500),
      ]);
      setJudges(jl || []);
      setCompetitions(chRes?.challenges || []);
      setAssignments(al || []);
    } catch (e) {
      setError(e?.message || 'Failed to load.');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const assign = async () => {
    setError('');
    const judge = judges.find((j) => j.id === selJudge);
    if (!judge || !selComp || !selRole) { setError('Pick a competition, judge and role.'); return; }

    const wwccCheck = canAssignJudge(judge, requiresWWCC);
    if (!wwccCheck.ok) { setError(wwccCheck.reason); return; }

    const sep = checkRoleSeparation(assignments, selComp, selJudge, selRole);
    if (!sep.ok) { setError(sep.reason); return; }

    const comp = competitions.find((c) => c.id === selComp);
    setBusy(true);
    try {
      await base44.entities.CompetitionAssignment.create({
        competition_id: selComp,
        competition_title: comp?.title || comp?.theme || '',
        judge_profile_id: judge.id,
        judge_name: judge.name,
        judge_email: judge.email,
        role: selRole,
        assigned_at: new Date().toISOString(),
        status: 'active',
      });
      setSelComp(''); setSelJudge(''); setSelRole('judge'); setRequiresWWCC(false);
      await load();
      onReload?.();
    } catch (e) {
      setError(e?.message || 'Assignment failed.');
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (a) => {
    setBusy(true);
    try {
      await base44.entities.CompetitionAssignment.update(a.id, { status: 'revoked' });
      await load();
      onReload?.();
    } catch (e) {
      setError(e?.message || 'Revoke failed.');
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center gap-2"><Link2 className="h-5 w-5 text-primary" /><h3 className="font-heading text-lg font-bold">Assign a judge</h3></div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <Field label="Competition">
            <select value={selComp} onChange={(e) => setSelComp(e.target.value)} className="w-full rounded-lg border border-input bg-white/5 px-3 py-2 text-sm">
              <option value="">Select…</option>
              {competitions.map((c) => <option key={c.id} value={c.id}>{c.title || c.theme}</option>)}
            </select>
          </Field>
          <Field label="Judge (active only)">
            <select value={selJudge} onChange={(e) => setSelJudge(e.target.value)} className="w-full rounded-lg border border-input bg-white/5 px-3 py-2 text-sm">
              <option value="">Select…</option>
              {judges.map((j) => <option key={j.id} value={j.id}>{j.name} — WWCC {wwccLabel(j)}</option>)}
            </select>
          </Field>
          <Field label="Role">
            <select value={selRole} onChange={(e) => setSelRole(e.target.value)} className="w-full rounded-lg border border-input bg-white/5 px-3 py-2 text-sm">
              {Object.entries(ROLE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </Field>
        </div>

        <label className="mt-3 flex items-center gap-2.5">
          <input type="checkbox" checked={requiresWWCC} onChange={(e) => setRequiresWWCC(e.target.checked)} className="h-4 w-4 accent-primary" />
          <span className="text-sm">This competition requires a Working With Children check (school/child audience)</span>
        </label>

        {error && (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" /><span>{error}</span>
          </div>
        )}

        <button onClick={assign} disabled={busy}
          className="mt-4 inline-flex items-center gap-2 rounded-xl grad-bg px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />} Assign
        </button>
      </div>

      <div>
        <h3 className="font-heading text-lg font-bold">Current assignments</h3>
        {assignments.filter((a) => a.status === 'active').length === 0 ? (
          <div className="mt-3 rounded-2xl border border-dashed border-border bg-card/50 px-6 py-10 text-center text-sm text-muted-foreground">No active assignments.</div>
        ) : (
          <div className="mt-3 space-y-2">
            {assignments.filter((a) => a.status === 'active').map((a) => (
              <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-card px-4 py-3">
                <div>
                  <p className="text-sm font-semibold">{a.judge_name} <span className="text-muted-foreground">· {a.judge_email}</span></p>
                  <p className="text-xs text-muted-foreground">{a.competition_title || a.competition_id}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-lg bg-primary/15 px-2.5 py-1 text-xs font-bold text-primary">{ROLE_LABELS[a.role]}</span>
                  <button onClick={() => revoke(a)} className="rounded-lg border border-destructive/40 bg-destructive/10 p-2 text-destructive hover:bg-destructive/20"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <p className="mb-1 text-xs font-semibold text-muted-foreground">{label}</p>
      {children}
    </div>
  );
}
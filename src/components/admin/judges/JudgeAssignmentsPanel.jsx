import { useCallback, useEffect, useState } from 'react';
import { UserPlus } from 'lucide-react';
import { adminChallengeApi } from '@/lib/adminChallengeApi';
import { ASSIGNMENT_LABELS, canWithdraw, formatDate, disciplineList } from './judgeMeta';
import WithdrawJudgeDialog from './WithdrawJudgeDialog';

export default function JudgeAssignmentsPanel({ challenges = [], judges = [], actingEmail }) {
  const [challengeId, setChallengeId] = useState(challenges[0]?.id || '');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [busy, setBusy] = useState('');
  const [withdrawRow, setWithdrawRow] = useState(null);

  useEffect(() => {
    if (!challengeId && challenges[0]?.id) setChallengeId(challenges[0].id);
  }, [challenges, challengeId]);

  const load = useCallback(async () => {
    if (!challengeId) return;
    setLoading(true);
    setError('');
    try {
      setData(await adminChallengeApi.judgeAssignments({ challengeId }));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [challengeId]);

  useEffect(() => { load(); }, [load]);

  const assigned = new Set((data?.assignments || []).filter((a) => canWithdraw(a.status)).map((a) => a.judge_email));

  const invite = async () => {
    if (!inviteEmail) return;
    setBusy('invite');
    setError('');
    try {
      await adminChallengeApi.assignJudge({ challengeId, judgeEmail: inviteEmail, actingEmail });
      setInviteEmail('');
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy('');
    }
  };

  const withdraw = async (row, reason) => {
    setBusy(row.id);
    setError('');
    try {
      await adminChallengeApi.unassignJudge({ assignmentId: row.id, reason, actingEmail });
      setWithdrawRow(null);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy('');
    }
  };

  return (
    <section className="mt-5 rounded-2xl border border-border bg-card/60 p-5">
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="font-heading text-base font-bold">Challenge panel</h3>
        <label htmlFor="ja-challenge" className="sr-only">Challenge</label>
        <select id="ja-challenge" className="c53-input w-64" value={challengeId} onChange={(e) => setChallengeId(e.target.value)}>
          {challenges.map((c) => <option key={c.id} value={c.id}>{c.title || c.theme}</option>)}
        </select>
        {data?.challenge && (
          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${data.panel_complete ? 'bg-success/15 text-success' : 'bg-muted text-muted-foreground'}`}>
            {data.accepted_count ?? 0} of {data.challenge.judges_required ?? 0} accepted
            {data.panel_complete ? ' · panel complete' : ''}
          </span>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-2">
        <div>
          <label htmlFor="ja-invite" className="mb-1.5 block text-sm font-semibold">Invite a judge</label>
          <select id="ja-invite" className="c53-input w-72" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)}>
            <option value="">Choose a judge from the roster</option>
            {judges.filter((j) => j.active && !assigned.has(j.email)).map((j) => (
              <option key={j.id} value={j.email}>
                {j.name} — {disciplineList(j.disciplines?.length ? j.disciplines : j.categories)}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={invite}
          disabled={!inviteEmail || !challengeId || busy === 'invite'}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          <UserPlus className="h-4 w-4" /> {busy === 'invite' ? 'Inviting…' : 'Send invitation'}
        </button>
      </div>

      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}

      {loading ? (
        <p className="mt-4 text-sm text-muted-foreground">Loading the panel…</p>
      ) : (data?.assignments || []).length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">No judges have been invited to this challenge yet.</p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Judge</th>
                <th className="px-4 py-3">Invitation</th>
                <th className="px-4 py-3">Scoring</th>
                <th className="px-4 py-3">Recusals</th>
                <th className="px-4 py-3">Invited</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {(data.assignments || []).map((a) => (
                <tr key={a.id} className="border-t border-border align-top">
                  <td className="px-4 py-3">
                    <div className="font-semibold">{a.judge_name || '—'}</div>
                    <div className="text-xs text-muted-foreground">{a.judge_email}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold">
                      {ASSIGNMENT_LABELS[a.status] || a.status}
                    </span>
                    {a.cancel_reason && <div className="mt-1 text-xs text-muted-foreground">{a.cancel_reason}</div>}
                  </td>
                  <td className="px-4 py-3">
                    {a.scored_entries ?? 0}/{a.scorable_entries ?? 0}
                    {a.scoring_complete && <span className="ml-1 text-xs font-semibold text-success">done</span>}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {(a.recused_categories || []).length ? a.recused_categories.join(', ') : '—'}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDate(a.assigned_at)}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => setWithdrawRow(a)}
                      disabled={!canWithdraw(a.status) || busy === a.id}
                      className="rounded-lg border border-destructive/40 px-3 py-1.5 text-xs font-semibold text-destructive disabled:opacity-40"
                    >
                      {busy === a.id ? 'Withdrawing…' : 'Withdraw'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {withdrawRow && (
        <WithdrawJudgeDialog
          open={!!withdrawRow}
          onOpenChange={(v) => !v && setWithdrawRow(null)}
          row={withdrawRow}
          busy={busy === withdrawRow.id}
          onConfirm={(reason) => withdraw(withdrawRow, reason)}
        />
      )}
    </section>
  );
}
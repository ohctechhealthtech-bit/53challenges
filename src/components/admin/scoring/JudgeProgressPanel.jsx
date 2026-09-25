import { num } from './scoringMeta';

export default function JudgeProgressPanel({ data, loading }) {
  const judges = data?.judges || [];
  const s = data?.summary || {};

  return (
    <section className="mt-5 rounded-2xl border border-border bg-card/60 p-5">
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="font-heading text-base font-bold">Judge progress</h3>
        {!loading && (
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="rounded-full bg-muted px-2.5 py-1 font-semibold">{s.accepted ?? 0} accepted</span>
            {(s.pending ?? 0) > 0 && <span className="rounded-full bg-gold/15 px-2.5 py-1 font-semibold text-gold">{s.pending} invited</span>}
            <span className="rounded-full bg-muted px-2.5 py-1 font-semibold">{s.scoring_complete ?? 0} finished scoring</span>
            {(s.awaiting_attestation ?? 0) > 0 && (
              <span className="rounded-full bg-gold/15 px-2.5 py-1 font-semibold text-gold">{s.awaiting_attestation} awaiting conflict check</span>
            )}
            {(s.with_conflicts ?? 0) > 0 && (
              <span className="rounded-full bg-destructive/15 px-2.5 py-1 font-semibold text-destructive">{s.with_conflicts} with conflicts</span>
            )}
          </div>
        )}
      </div>

      {loading ? (
        <p className="mt-4 text-sm text-muted-foreground">Loading the panel…</p>
      ) : judges.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">No judges are on this challenge yet.</p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Judge</th>
                <th className="px-4 py-3">Invitation</th>
                <th className="px-4 py-3">Progress</th>
                <th className="px-4 py-3">Average</th>
                <th className="px-4 py-3">Conflict check</th>
              </tr>
            </thead>
            <tbody>
              {judges.map((j) => (
                <tr key={j.judge_email} className="border-t border-border align-top">
                  <td className="px-4 py-3">
                    <div className="font-semibold">{j.judge_name || j.judge_email}</div>
                    <div className="text-xs text-muted-foreground">{j.judge_email}</div>
                    {!j.on_master_roster && <div className="text-xs text-gold">Not on the master roster</div>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${j.assignment_status === 'accepted' ? 'bg-success/15 text-success' : 'bg-gold/15 text-gold'}`}>
                      {j.assignment_status || '—'}
                    </span>
                    {!j.can_score && <div className="mt-1 text-xs text-muted-foreground">Cannot score</div>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-semibold">{j.scored_entries ?? 0}/{j.eligible_entries ?? 0} scored</div>
                    <div className="mt-1 h-1.5 w-32 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, j.progress_percent || 0)}%` }} />
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {j.progress_percent ?? 0}%{j.scoring_complete ? ' · complete' : ` · ${j.outstanding_entries ?? 0} to go`}
                    </div>
                  </td>
                  <td className="px-4 py-3">{num(j.average_total)}</td>
                  <td className="px-4 py-3">
                    <span className={j.attestation_complete ? 'text-success' : 'text-gold'}>
                      {j.attestation_complete ? 'Confirmed' : 'Awaiting confirmation'}
                    </span>
                    <div className="text-xs text-muted-foreground">
                      {(j.attestations || []).length} on record
                      {(j.recused_entry_ids || []).length > 0 && ` · ${j.recused_entry_ids.length} entries stepped back from`}
                      {(j.recused_categories || []).length > 0 && ` · ${j.recused_categories.length} categories`}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
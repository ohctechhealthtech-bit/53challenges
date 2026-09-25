import { CRITERIA, num } from './scoringMeta';

function JudgeBreakdown({ scores, outstanding }) {
  if (!scores?.length) {
    return <p className="text-xs text-muted-foreground">No judge has scored this yet{outstanding ? ` · ${outstanding} outstanding` : ''}.</p>;
  }
  return (
    <div className="space-y-1.5">
      {scores.map((s) => (
        <div key={s.id || s.judge_email} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          <span className="min-w-[130px] font-semibold">{s.judge_name || s.judge_email}</span>
          {CRITERIA.map((c) => (
            <span key={c.key} className="text-muted-foreground">
              {c.label} <span className="font-semibold text-foreground">{num(s.criteria?.[c.key])}</span>
            </span>
          ))}
          <span className="rounded-full bg-muted px-2 py-0.5 font-bold">{num(s.total)}/100</span>
          <span className={s.submitted ? 'text-success' : 'text-gold'}>{s.submitted ? 'Submitted' : 'Draft'}</span>
          {s.is_migrated && <span className="text-muted-foreground">Migrated</span>}
        </div>
      ))}
    </div>
  );
}

export default function ScoringTable({ rows, locked, onEdit, onResolveTie }) {
  if (!rows.length) {
    return <p className="mt-4 text-sm text-muted-foreground">No scorable submissions on this challenge yet.</p>;
  }

  return (
    <div className="mt-4 overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-4 py-3">Submission</th>
            <th className="px-4 py-3">Judge scores</th>
            <th className="px-4 py-3">Panel</th>
            <th className="px-4 py-3">Combined</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.entry_id} className="border-t border-border align-top">
              <td className="px-4 py-3">
                <div className="font-semibold">{r.title || 'Untitled'}</div>
                <div className="text-xs text-muted-foreground">
                  {r.creator_name || '—'}{r.state ? ` · ${r.state}` : ''}{r.division_name ? ` · ${r.division_name}` : ''}
                </div>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {r.chief_judge_pick && <span className="rounded-full bg-gold/15 px-2 py-0.5 text-[11px] font-bold text-gold">Chief judge pick</span>}
                  {r.tie_break_pending && <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-[11px] font-bold text-destructive">Tie</span>}
                  {r.requires_admin_score_review && <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-[11px] font-bold text-destructive">Needs review</span>}
                  {r.is_finalist && <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-bold text-primary">Finalist</span>}
                </div>
              </td>
              <td className="max-w-[520px] px-4 py-3">
                <JudgeBreakdown scores={r.judge_scores} outstanding={r.judges_outstanding} />
              </td>
              <td className="px-4 py-3">
                <div className="font-semibold">{r.judges_submitted ?? 0}/{(r.judges_submitted ?? 0) + (r.judges_outstanding ?? 0)} submitted</div>
                <div className="text-xs text-muted-foreground">
                  Normalised {num(r.judge_score_normalised)}
                  {r.scoring_complete ? ' · complete' : ''}
                </div>
              </td>
              <td className="px-4 py-3">
                <div className="font-bold">{num(r.combined_score)}</div>
                <div className="text-xs text-muted-foreground">Votes {r.votes ?? 0} · public {num(r.public_vote_normalised)}</div>
              </td>
              <td className="px-4 py-3">
                <div className="flex flex-col items-stretch gap-1.5">
                  <button
                    onClick={() => onEdit(r)}
                    disabled={locked}
                    className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Edit score
                  </button>
                  <button
                    onClick={() => onResolveTie(r)}
                    disabled={!r.tie_break_pending}
                    className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Resolve tie
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
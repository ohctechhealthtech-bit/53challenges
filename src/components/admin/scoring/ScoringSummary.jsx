import { num } from './scoringMeta';

function Stat({ label, value, tone = '' }) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`mt-1 font-heading text-xl font-extrabold ${tone}`}>{value}</div>
    </div>
  );
}

export default function ScoringSummary({ board }) {
  if (!board) return null;
  const s = board.summary || {};
  const w = board.weighting || {};
  const panel = board.panel || {};

  return (
    <section className="mt-5">
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Scorable" value={s.scorable_entries ?? 0} />
        <Stat label="Scored" value={s.scored_entries ?? 0} />
        <Stat label="Fully scored" value={s.fully_scored_entries ?? 0} />
        <Stat label="Not scored" value={s.unscored_entries ?? 0} />
        <Stat label="Ties pending" value={s.ties_pending ?? 0} tone={s.ties_pending ? 'text-destructive' : ''} />
        <Stat label="Needs review" value={s.needs_score_review ?? 0} tone={s.needs_score_review ? 'text-destructive' : ''} />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
        <span className="rounded-full bg-muted px-3 py-1 font-semibold">
          Judges {num(w.judge_weight, 0)}% · Public vote {num(w.public_weight, 0)}%
        </span>
        {w.weights_locked && (
          <span className="rounded-full bg-muted px-3 py-1 text-muted-foreground">
            {w.weights_lock_reason || 'Weights locked'}
          </span>
        )}
        <span className={`rounded-full px-3 py-1 font-semibold ${panel.panel_complete ? 'bg-success/15 text-success' : 'bg-gold/15 text-gold'}`}>
          Panel {panel.accepted_judges ?? 0} of {panel.judges_required ?? 0} accepted{panel.panel_complete ? ' · complete' : ''}
        </span>
        {board.scores_locked && (
          <span className="rounded-full bg-destructive/15 px-3 py-1 font-semibold text-destructive">
            Scoring locked{board.scores_lock_reason ? ` · ${board.scores_lock_reason}` : ''}
          </span>
        )}
        {board.has_unmigrated_legacy && (
          <span className="rounded-full bg-gold/15 px-3 py-1 font-semibold text-gold">Legacy scores to migrate</span>
        )}
      </div>
    </section>
  );
}
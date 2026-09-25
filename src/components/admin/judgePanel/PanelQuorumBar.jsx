export default function PanelQuorumBar({ challenge, quorum, recusalsCount }) {
  const required = quorum?.judges_required || 0;
  const accepted = quorum?.accepted || 0;
  const pct = required ? Math.min(100, Math.round((accepted / required) * 100)) : 0;

  return (
    <section className="mt-5 rounded-2xl border border-border bg-card/60 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-heading text-base font-bold">
            {quorum?.quorum_text || `${accepted} of ${required} judges accepted`}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {challenge?.title}
            {challenge?.stage ? ` · ${challenge.stage} stage` : ''}
            {challenge?.round_stage ? ` · round ${challenge.round_stage}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          <span className={`rounded-full px-3 py-1 font-semibold ${quorum?.panel_complete ? 'bg-success/15 text-success' : 'bg-gold/15 text-gold'}`}>
            {quorum?.panel_complete ? 'Panel complete' : `Short by ${quorum?.short_by ?? 0}`}
          </span>
          {(quorum?.pending ?? 0) > 0 && <span className="rounded-full bg-gold/15 px-3 py-1 font-semibold text-gold">{quorum.pending} awaiting reply</span>}
          {(quorum?.cancelled ?? 0) > 0 && <span className="rounded-full bg-muted px-3 py-1">{quorum.cancelled} removed</span>}
          {recusalsCount > 0 && <span className="rounded-full bg-destructive/15 px-3 py-1 font-semibold text-destructive">{recusalsCount} recusals</span>}
          <span className="rounded-full bg-muted px-3 py-1">{challenge?.coi_required ? 'Conflict check required' : 'No conflict check'}</span>
        </div>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
        <div className={`h-full rounded-full ${quorum?.panel_complete ? 'bg-success' : 'bg-primary'}`} style={{ width: `${pct}%` }} />
      </div>
    </section>
  );
}
function Stat({ label, value, tone = '' }) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`mt-1 font-heading text-xl font-extrabold ${tone}`}>{value}</div>
    </div>
  );
}

export default function VotesSummary({ data }) {
  if (!data) return null;
  const c = data.counts || {};
  const ch = data.challenge || {};

  return (
    <section className="mt-5">
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Stat label="Votes" value={c.total ?? 0} />
        <Stat label="Counting" value={c.valid ?? 0} tone="text-success" />
        <Stat label="Flagged" value={c.flagged ?? 0} tone={c.flagged ? 'text-gold' : ''} />
        <Stat label="Blocked" value={c.blocked ?? 0} tone={c.blocked ? 'text-destructive' : ''} />
        <Stat label="Needs a look" value={c.suspicious ?? 0} tone={c.suspicious ? 'text-gold' : ''} />
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-sm">
        <span className={`rounded-full px-3 py-1 font-semibold ${ch.public_voting_enabled ? 'bg-success/15 text-success' : 'bg-muted text-muted-foreground'}`}>
          Public voting {ch.public_voting_enabled ? 'open' : 'closed'}
        </span>
        {ch.round_stage && (
          <span className="rounded-full bg-muted px-3 py-1 text-muted-foreground">
            {String(ch.round_stage).replace(/_/g, ' ')}
          </span>
        )}
        <span className="rounded-full bg-muted px-3 py-1 text-muted-foreground">Showing the 300 most recent</span>
      </div>
    </section>
  );
}
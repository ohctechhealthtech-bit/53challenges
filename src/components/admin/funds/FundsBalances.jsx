import { money } from './fundsMeta';

function Stat({ label, value, tone = '' }) {
  return (
    <div className="rounded-xl border border-border bg-card/60 px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-1 font-heading text-lg font-bold ${tone}`}>{value}</p>
    </div>
  );
}

export default function FundsBalances({ balances = {}, totals = {} }) {
  return (
    <section className="mt-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-primary/30 bg-primary/10 px-5 py-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Sponsorship pool</p>
          <p className="mt-1 font-heading text-2xl font-extrabold">{money(balances.sponsorship_pool)}</p>
        </div>
        <div className="rounded-2xl border border-success/30 bg-success/10 px-5 py-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Competition fund</p>
          <p className="mt-1 font-heading text-2xl font-extrabold">{money(balances.competition_fund)}</p>
        </div>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Entry fees" value={money(totals.entry_fees_collected)} />
        <Stat label="Sponsors" value={money(totals.sponsor_contributions)} />
        <Stat label="Donations" value={money(totals.donations)} />
        <Stat label="Paid out" value={money(totals.disbursed)} />
        <Stat label="Refunded" value={money(totals.refunded)} tone="text-destructive" />
        <Stat label="Paid entries" value={totals.paid_entries ?? 0} />
      </div>
    </section>
  );
}
import { money, titleCase } from './sponsorsMeta';

function Stat({ label, value }) {
  return (
    <div className="rounded-xl border border-border bg-card/60 px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 font-heading text-lg font-bold">{value}</p>
    </div>
  );
}

export default function SponsorSummary({ counts = {}, unread = 0, prospects = 0 }) {
  return (
    <section className="mt-5">
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Sponsors" value={counts.total ?? 0} />
        <Stat label="Showing publicly" value={counts.active ?? 0} />
        <Stat label="Hidden" value={counts.hidden ?? 0} />
        <Stat label="With ads" value={counts.with_ads ?? 0} />
        <Stat label="Contributions" value={money(counts.contribution_total)} />
        <Stat label="Unread enquiries" value={unread} />
      </div>
      {(counts.by_tier || []).length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          {counts.by_tier.map((t) => (
            <span key={t.tier} className="rounded-full border border-border px-3 py-1">
              {titleCase(t.tier)} · {t.count}
            </span>
          ))}
          {prospects > 0 && <span className="rounded-full border border-border px-3 py-1">Prospects · {prospects}</span>}
        </div>
      )}
    </section>
  );
}
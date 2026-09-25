export default function CampaignPanel({ campaigns }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <h3 className="font-heading text-lg font-bold">Campaign performance</h3>
      <p className="text-xs text-muted-foreground">Sends via built-in email (registered users only). Opens & click attribution require an external email provider.</p>
      <div className="mt-3 space-y-2 text-sm">
        {campaigns.map((c) => (
          <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-muted/30 px-3 py-2">
            <div><p className="font-semibold">{c.name}</p><p className="text-xs text-muted-foreground">{c.type.replace(/_/g, ' ')} · {c.status}</p></div>
            <div className="flex gap-3 text-xs"><span>Sent <b className="text-foreground">{c.sent}</b></span><span className="text-muted-foreground">Skipped {c.skipped}</span></div>
          </div>
        ))}
        {!campaigns.length && <p className="text-muted-foreground">No campaigns yet.</p>}
      </div>
    </div>
  );
}
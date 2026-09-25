export default function ModerationPanel({ moderation }) {
  const { pending, approved, rejected, avgPendingAgeDays } = moderation;
  const total = pending + approved + rejected;
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <h3 className="font-heading text-lg font-bold">Moderation queue</h3>
      <div className="mt-3 grid grid-cols-3 gap-3 text-center">
        <Metric label="Pending" value={pending} color="text-amber-300" />
        <Metric label="Approved" value={approved} color="text-emerald-300" />
        <Metric label="Rejected" value={rejected} color="text-rose-300" />
      </div>
      <p className="mt-4 text-sm text-muted-foreground">Avg pending age: <b className="text-foreground">{avgPendingAgeDays} days</b></p>
      <div className="mt-3 flex h-2.5 overflow-hidden rounded-full bg-muted">
        <div className="h-2.5 bg-amber-400" style={{ width: `${total ? (pending / total) * 100 : 0}%` }} />
        <div className="h-2.5 bg-emerald-400" style={{ width: `${total ? (approved / total) * 100 : 0}%` }} />
        <div className="h-2.5 bg-rose-400" style={{ width: `${total ? (rejected / total) * 100 : 0}%` }} />
      </div>
    </div>
  );
}

function Metric({ label, value, color }) {
  return (
    <div className="rounded-xl bg-muted/40 p-3">
      <p className={`font-heading text-2xl font-extrabold ${color}`}>{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
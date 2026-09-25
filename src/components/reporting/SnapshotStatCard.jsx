/** Single big-number stat tile for the admin snapshot page. */
export default function SnapshotStatCard({ icon: Icon, label, value, hint }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center gap-2 text-muted-foreground">
        {Icon ? <Icon className="h-4 w-4" aria-hidden="true" /> : null}
        <p className="text-sm font-semibold">{label}</p>
      </div>
      <p className="mt-3 font-heading text-3xl font-extrabold">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
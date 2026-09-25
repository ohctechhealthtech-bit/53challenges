export default function FieldGuidePanel({ guide }) {
  if (!guide) return null;
  return (
    <div className="mt-4 rounded-xl border border-border bg-muted/40 p-4">
      <p className="font-heading text-sm font-bold">{guide.title || 'Field guide'}</p>
      {guide.purpose && <p className="mt-1 text-sm text-muted-foreground">{guide.purpose}</p>}
      <dl className="mt-3 grid gap-2 sm:grid-cols-2">
        {(guide.fields || []).map(([name, detail]) => (
          <div key={name} className="rounded-lg bg-card p-3">
            <dt className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{name}</dt>
            <dd className="mt-1 text-sm">{detail}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
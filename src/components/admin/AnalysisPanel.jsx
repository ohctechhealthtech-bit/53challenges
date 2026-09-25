export default function AnalysisPanel({ analysis }) {
  if (!analysis) return null;
  return (
    <div className="mt-4 rounded-xl border border-primary/40 bg-primary/5 p-4">
      <p className="font-heading text-sm font-bold">AI analysis</p>
      <p className="mt-1 text-sm text-muted-foreground">{analysis.summary}</p>

      {(analysis.key_numbers || []).length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {analysis.key_numbers.map((n) => (
            <span key={n.label} className="rounded-lg bg-card px-3 py-1.5 text-xs">
              <span className="text-muted-foreground">{n.label}: </span>
              <span className="font-bold">{n.value}</span>
            </span>
          ))}
        </div>
      )}

      <Block title="Things to look at" items={analysis.risks} />
      <Block title="Suggested next steps" items={analysis.next_actions} />
    </div>
  );
}

function Block({ title, items }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="mt-3">
      <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{title}</p>
      <ul className="mt-1.5 space-y-1.5">
        {items.map((it, i) => {
          const heading = typeof it === 'string' ? it : it.title || it.action || '';
          const detail = typeof it === 'string' ? '' : it.detail || it.reason || '';
          return (
            <li key={i} className="text-sm">
              <span className="font-semibold">{heading}</span>
              {detail && <span className="text-muted-foreground"> — {detail}</span>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
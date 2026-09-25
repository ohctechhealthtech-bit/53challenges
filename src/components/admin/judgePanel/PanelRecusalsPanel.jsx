import { formatDateTime, prettyList } from './panelMeta';

export default function PanelRecusalsPanel({ recusals, challengeRecusals }) {
  const rows = recusals || [];
  const wide = challengeRecusals || [];

  return (
    <section className="mt-5 rounded-2xl border border-border bg-card/60 p-5">
      <h3 className="font-heading text-base font-bold">
        Declared conflicts
        <span className="ml-2 text-sm font-normal text-muted-foreground">{rows.length}</span>
      </h3>

      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">No judge on this panel has declared a conflict.</p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Judge</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Entrants involved</th>
                <th className="px-4 py-3">Declared</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.id || `${r.judge_email}-${i}`} className="border-t border-border">
                  <td className="px-4 py-3">
                    <div className="font-semibold">{r.judge_name || r.judge_email}</div>
                    <div className="text-xs text-muted-foreground">{r.judge_email}</div>
                  </td>
                  <td className="px-4 py-3">{prettyList(r.category ? [r.category] : r.categories)}</td>
                  <td className="px-4 py-3">{(r.conflicted_entrant_ids || []).length || '—'}</td>
                  <td className="px-4 py-3">{formatDateTime(r.attested_at || r.created_date)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {wide.length > 0 && (
        <p className="mt-3 text-sm text-muted-foreground">
          {wide.length} conflict{wide.length === 1 ? '' : 's'} recorded on this challenge by judges who are not on the panel.
        </p>
      )}
    </section>
  );
}
export default function TodayBatchTable({ rows = [] }) {
  const fmt = (d) => new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return (
    <section className="mt-8">
      <h2 className="text-lg font-bold">Today's moderation batches</h2>
      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">No entries have been moderated today.</p>
      ) : (
        <div className="mt-3 overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Time</th>
                <th className="px-3 py-2">Batch</th>
                <th className="px-3 py-2 text-right">Approved</th>
                <th className="px-3 py-2 text-right">Rejected</th>
                <th className="px-3 py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.batch_id} className="border-t border-border">
                  <td className="px-3 py-2">{fmt(r.moderated_at)}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {r.batch_id.startsWith('single') ? 'Single action' : 'Bulk action'}
                  </td>
                  <td className="px-3 py-2 text-right font-semibold text-emerald-500">{r.approved}</td>
                  <td className="px-3 py-2 text-right font-semibold text-destructive">{r.rejected}</td>
                  <td className="px-3 py-2 text-right">{r.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
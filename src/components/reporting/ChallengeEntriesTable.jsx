export default function ChallengeEntriesTable({ rows = [] }) {
  return (
    <section className="mt-10">
      <h2 className="text-lg font-bold">Entries per challenge</h2>
      <div className="mt-3 overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Challenge</th>
              <th className="px-3 py-2">Category</th>
              <th className="px-3 py-2">Stage</th>
              <th className="px-3 py-2 text-right">Entries</th>
              <th className="px-3 py-2 text-right">Pending</th>
              <th className="px-3 py-2 text-right">Approved</th>
              <th className="px-3 py-2 text-right">Rejected</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-border">
                <td className="px-3 py-2 font-medium">{r.title}</td>
                <td className="px-3 py-2 text-muted-foreground">{r.category}</td>
                <td className="px-3 py-2 text-muted-foreground">{r.lifecycle_status}</td>
                <td className="px-3 py-2 text-right font-semibold">{r.total}</td>
                <td className="px-3 py-2 text-right text-muted-foreground">{r.pending}</td>
                <td className="px-3 py-2 text-right text-muted-foreground">{r.approved}</td>
                <td className="px-3 py-2 text-right text-muted-foreground">{r.rejected}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
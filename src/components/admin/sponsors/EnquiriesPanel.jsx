import { shortDate, STATUS_TONE, titleCase } from './sponsorsMeta';

export default function EnquiriesPanel({ applications = [], counts = {}, statuses = [], filter, onFilter, onOpen }) {
  return (
    <section className="mt-8">
      <h3 className="font-heading text-base font-bold">
        Sponsor enquiries
        <span className="ml-2 text-sm font-normal text-muted-foreground">
          {counts.total ?? 0} · {counts.unread ?? 0} unread
        </span>
      </h3>

      <div className="mt-3 flex flex-wrap gap-2">
        {['', ...statuses].map((s) => (
          <button
            key={s || 'all'}
            onClick={() => onFilter(s)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${filter === s ? 'bg-primary text-primary-foreground' : 'border border-border hover:bg-muted'}`}
          >
            {s ? titleCase(s) : 'All'}{s && counts[s] != null ? ` · ${counts[s]}` : ''}
          </button>
        ))}
      </div>

      <div className="mt-4 overflow-x-auto rounded-2xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Organisation</th>
              <th className="px-4 py-3">Contact</th>
              <th className="px-4 py-3 text-right">Budget</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Received</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {applications.map((a) => (
              <tr key={a.id} className="border-t border-border align-top">
                <td className="px-4 py-3">
                  <span className="block font-semibold">
                    {a.organisation_name || a.name || '—'}
                    {(a.is_read === false || a.read === false) && <span className="ml-2 rounded-full bg-primary/15 px-2 py-0.5 text-xs font-semibold text-primary">New</span>}
                  </span>
                  {a.suggested_tier && <span className="text-xs text-muted-foreground">Suggested {titleCase(a.suggested_tier)}</span>}
                </td>
                <td className="px-4 py-3">
                  <span className="block">{a.contact_name || '—'}</span>
                  <span className="text-xs text-muted-foreground">{a.contact_email}</span>
                </td>
                <td className="px-4 py-3 text-right">{a.estimated_budget || '—'}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_TONE[a.status] || 'bg-muted text-muted-foreground'}`}>
                    {titleCase(a.status)}
                  </span>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{shortDate(a.submitted_at || a.created_date)}</td>
                <td className="px-4 py-3">
                  <button onClick={() => onOpen(a)} className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted">Open</button>
                </td>
              </tr>
            ))}
            {applications.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">No enquiries here.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
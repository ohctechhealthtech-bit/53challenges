import { money, shortDate, TIER_TONE, titleCase } from './sponsorsMeta';

export default function SponsorTable({ sponsors = [], onEdit, onToggle, onDelete, busyId }) {
  return (
    <div className="mt-4 overflow-x-auto rounded-2xl border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-4 py-3">Sponsor</th>
            <th className="px-4 py-3">Tier</th>
            <th className="px-4 py-3">Contact</th>
            <th className="px-4 py-3 text-right">Contribution</th>
            <th className="px-4 py-3">Ads</th>
            <th className="px-4 py-3">Public</th>
            <th className="px-4 py-3">Added</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {sponsors.map((s) => (
            <tr key={s.id} className="border-t border-border align-top">
              <td className="px-4 py-3">
                <span className="block font-semibold">{s.name}</span>
                {s.website_url && (
                  <a href={s.website_url} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline">
                    {s.website_url.replace(/^https?:\/\//, '')}
                  </a>
                )}
                {s.season && <span className="ml-2 text-xs text-muted-foreground">Season {s.season}</span>}
              </td>
              <td className="px-4 py-3">
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${TIER_TONE[s.tier] || 'bg-muted text-muted-foreground'}`}>
                  {titleCase(s.tier)}
                </span>
              </td>
              <td className="px-4 py-3">
                <span className="block">{s.contact_name || '—'}</span>
                <span className="text-xs text-muted-foreground">{s.contact_email}</span>
              </td>
              <td className="px-4 py-3 text-right font-semibold">{money(s.contribution_amount)}</td>
              <td className="px-4 py-3 text-muted-foreground">{s.ad_asset_count ?? (s.ad_assets || []).length}</td>
              <td className="px-4 py-3">
                {s.is_active === false
                  ? <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">Hidden</span>
                  : <span className="rounded-full bg-success/15 px-2 py-0.5 text-xs font-semibold text-success">Showing</span>}
              </td>
              <td className="px-4 py-3 text-muted-foreground">{shortDate(s.created_date)}</td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => onEdit(s)} className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted">Edit</button>
                  <button
                    onClick={() => onToggle(s)}
                    disabled={busyId === s.id}
                    className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted disabled:opacity-50"
                  >
                    {s.is_active === false ? 'Show' : 'Hide'}
                  </button>
                  <button onClick={() => onDelete(s)} className="rounded-lg border border-destructive/40 px-3 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive/10">Delete</button>
                </div>
              </td>
            </tr>
          ))}
          {sponsors.length === 0 && (
            <tr><td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">No sponsors match these filters.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
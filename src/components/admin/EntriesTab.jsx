import { useCallback, useEffect, useState } from 'react';
import SectionToolbar from '@/components/admin/SectionToolbar';
import EntryActionButtons from '@/components/admin/EntryActionButtons';
import { adminChallengeApi } from '@/lib/adminChallengeApi';

const STATES = ['all', 'pending', 'approved', 'rejected', 'finalist'];

export default function EntriesTab({ challengeId, actingEmail }) {
  const [entries, setEntries] = useState([]);
  const [counts, setCounts] = useState({});
  const [state, setState] = useState('all');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!challengeId) { setEntries([]); return; }
    setLoading(true);
    setError('');
    try {
      const data = await adminChallengeApi.listEntries({ challengeId, state, ...(query ? { search: query } : {}) });
      setEntries(data.entries || []);
      setCounts(data.counts || {});
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [challengeId, state, query]);

  useEffect(() => { load(); }, [load]);

  return (
    <>
      <SectionToolbar
        section="entries"
        title="Entries"
        description="Every entry submitted to this challenge, pending and approved, with the tools to approve, reject, block or unblock."
        challengeId={challengeId}
      />

      {!challengeId ? (
        <p className="mt-6 text-sm text-muted-foreground">Choose a challenge above to see its entries.</p>
      ) : (
        <>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {STATES.map((s) => (
              <button
                key={s}
                onClick={() => setState(s)}
                className={`rounded-lg px-3 py-1.5 text-sm font-semibold capitalize ${state === s ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'}`}
              >
                {s}{counts[s] !== undefined ? ` (${counts[s]})` : ''}
              </button>
            ))}
            <form
              className="ml-auto flex items-center gap-2"
              onSubmit={(e) => { e.preventDefault(); setQuery(search.trim()); }}
            >
              <label htmlFor="et-search" className="sr-only">Search entries</label>
              <input
                id="et-search"
                className="c53-input w-60"
                placeholder="Search title or entrant"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <button type="submit" className="rounded-lg border border-border px-3 py-2 text-sm font-semibold">Search</button>
              {query && (
                <button
                  type="button"
                  onClick={() => { setSearch(''); setQuery(''); }}
                  className="text-sm text-muted-foreground underline"
                >
                  Clear
                </button>
              )}
            </form>
          </div>

          {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
          {loading ? (
            <p className="mt-6 text-sm text-muted-foreground">Loading entries…</p>
          ) : (
            <div className="mt-4 overflow-x-auto rounded-2xl border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Entry</th>
                    <th className="px-4 py-3">Entrant</th>
                    <th className="px-4 py-3">Division</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Votes</th>
                    <th className="px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e) => (
                    <tr key={e.id} className="border-t border-border">
                      <td className="px-4 py-3 font-semibold">
                        {e.title}
                        {e.is_finalist && <span className="ml-2 rounded bg-gold/20 px-1.5 py-0.5 text-[11px] font-bold text-gold">Finalist</span>}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{e.entrant_name}<br />{e.entrant_email}</td>
                      <td className="px-4 py-3">{e.division_name || '—'}</td>
                      <td className="px-4 py-3">{e.entry_type || e.media_type || '—'}</td>
                      <td className="px-4 py-3">
                        <span className="capitalize">{e.moderation_state || e.status}</span>
                        {e.rejection_reason && <span className="block text-xs text-muted-foreground">{e.rejection_reason}</span>}
                        {e.reviewed_by_email && (
                          <span className="block text-xs text-muted-foreground">Reviewed by {e.reviewed_by_email}</span>
                        )}
                        {e.refund_status === 'pending_review' && (
                          <span className="mt-1 inline-block rounded bg-gold/20 px-1.5 py-0.5 text-[11px] font-bold text-gold">Refund to review</span>
                        )}
                        {e.guardian_approval_status === 'pending' && (
                          <span className="mt-1 block text-xs text-muted-foreground">Guardian approval pending</span>
                        )}
                      </td>
                      <td className="px-4 py-3">{e.community_votes ?? e.vote_count ?? 0}</td>
                      <td className="px-4 py-3">
                        <EntryActionButtons entry={e} actingEmail={actingEmail} onDone={load} />
                      </td>
                    </tr>
                  ))}
                  {entries.length === 0 && (
                    <tr><td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">No entries in this view.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </>
  );
}
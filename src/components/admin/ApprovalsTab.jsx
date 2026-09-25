import { useCallback, useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import SectionToolbar from '@/components/admin/SectionToolbar';
import ApprovalRow from '@/components/admin/approvals/ApprovalRow';
import ApprovalPreviewDialog from '@/components/admin/approvals/ApprovalPreviewDialog';
import RejectReasonDialog from '@/components/admin/approvals/RejectReasonDialog';
import { adminChallengeApi } from '@/lib/adminChallengeApi';

export default function ApprovalsTab({ challenges = [], actingEmail, onCounts }) {
  const [rows, setRows] = useState([]);
  const [count, setCount] = useState(0);
  const [challengeId, setChallengeId] = useState('');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [previewRow, setPreviewRow] = useState(null);
  const [rejectRow, setRejectRow] = useState(null);
  const [busyId, setBusyId] = useState('');
  const [busyKind, setBusyKind] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await adminChallengeApi.listApprovals({
        ...(query ? { search: query } : {}),
        ...(challengeId ? { challengeId } : {}),
      });
      setRows(data.entries || []);
      const n = data.pending_count ?? data.count ?? 0;
      setCount(n);
      // The tab badge stays the platform-wide count, so only report it when
      // the list isn't narrowed by a filter or search.
      if (!query && !challengeId) onCounts?.(n);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [query, challengeId, onCounts]);

  useEffect(() => { load(); }, [load]);

  const decide = async (row, decision, reason) => {
    setBusyId(row.id);
    setBusyKind(decision);
    setError('');
    try {
      await adminChallengeApi.decideApproval({
        id: row.id,
        decision,
        ...(reason ? { reason } : {}),
        actingEmail,
      });
      setRejectRow(null);
      setPreviewRow(null);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId('');
      setBusyKind('');
    }
  };

  return (
    <>
      <SectionToolbar
        section="approvals"
        title="Content approvals"
        description="Participant entries waiting on an eligibility check. Approve one to make it public and votable, or reject it with a reason."
        challengeId={challengeId || undefined}
      />

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <label htmlFor="ap-challenge" className="text-sm font-semibold text-muted-foreground">Challenge</label>
        <select
          id="ap-challenge"
          className="c53-input w-64"
          value={challengeId}
          onChange={(e) => setChallengeId(e.target.value)}
        >
          <option value="">All challenges</option>
          {challenges.map((c) => (
            <option key={c.id} value={c.id}>{c.title || c.theme}</option>
          ))}
        </select>
        <form
          className="ml-auto flex items-center gap-2"
          onSubmit={(e) => { e.preventDefault(); setQuery(search.trim()); }}
        >
          <label htmlFor="ap-search" className="sr-only">Search entries</label>
          <input
            id="ap-search"
            className="c53-input w-56"
            placeholder="Search entrant, email or title"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button type="submit" className="rounded-lg bg-muted p-2.5 text-muted-foreground hover:text-foreground" aria-label="Search">
            <Search className="h-4 w-4" />
          </button>
        </form>
      </div>

      {error && <p className="mt-4 text-sm text-destructive">{error}</p>}

      <section className="mt-5 rounded-2xl border border-border bg-card/60 p-5">
        <h3 className="font-heading text-base font-bold">
          Content awaiting approval
          <span className="ml-2 text-sm font-normal text-muted-foreground">{count}</span>
        </h3>

        {loading ? (
          <p className="mt-4 text-sm text-muted-foreground">Loading entries…</p>
        ) : rows.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">Nothing is waiting on a review right now.</p>
        ) : (
          <div className="mt-4 space-y-3">
            {rows.map((row) => (
              <ApprovalRow
                key={row.id}
                row={row}
                busy={busyId === row.id ? busyKind : ''}
                onPreview={setPreviewRow}
                onApprove={(r) => decide(r, 'approve')}
                onReject={setRejectRow}
              />
            ))}
          </div>
        )}
      </section>

      {previewRow && (
        <ApprovalPreviewDialog
          open={!!previewRow}
          onOpenChange={(v) => !v && setPreviewRow(null)}
          entryId={previewRow.id}
          row={previewRow}
          busy={busyId === previewRow.id ? busyKind : ''}
          onApprove={(r) => decide(r, 'approve')}
          onReject={(r) => { setPreviewRow(null); setRejectRow(r); }}
        />
      )}

      {rejectRow && (
        <RejectReasonDialog
          open={!!rejectRow}
          onOpenChange={(v) => !v && setRejectRow(null)}
          row={rejectRow}
          busy={busyId === rejectRow.id ? busyKind : ''}
          onConfirm={(reason) => decide(rejectRow, 'reject', reason)}
        />
      )}
    </>
  );
}
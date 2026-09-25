import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Check, X, RotateCcw } from 'lucide-react';
import { challengeEngine } from '@/lib/challengeEngine';
import EntryModerationRow from './EntryModerationRow';
import EntryBulkActionBar from './EntryBulkActionBar';

const FILTERS = [
  { id: 'pending', label: 'Pending' },
  { id: 'approved', label: 'Approved' },
  { id: 'rejected', label: 'Rejected' },
];

export default function EntryModerationPanel({ challengeId }) {
  const [entries, setEntries] = useState([]);
  const [filter, setFilter] = useState('pending');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const [selected, setSelected] = useState([]);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkResult, setBulkResult] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await challengeEngine.entries(challengeId);
      setEntries(res.entries || []);
    } catch (e) {
      setError(e.message || 'Failed to load entries');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [challengeId]);

  const moderate = async (entry, status) => {
    setBusyId(entry.id);
    setError('');
    try {
      await challengeEngine.moderateEntry(entry.id, status);
      setEntries((prev) => prev.map((e) => (e.id === entry.id ? { ...e, status } : e)));
    } catch (e) {
      setError(e.message || 'Could not update this entry');
    } finally {
      setBusyId('');
    }
  };

  const toggleSelect = (id) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const bulkModerate = async (status) => {
    const ids = shown.filter((e) => selected.includes(e.id)).map((e) => e.id);
    if (!ids.length) return;
    const verb = status === 'approved' ? 'Approve' : status === 'rejected' ? 'Reject' : 'Reset';
    if (!window.confirm(`${verb} ${ids.length} selected ${ids.length === 1 ? 'entry' : 'entries'}?`)) return;
    setBulkBusy(true); setError(''); setBulkResult('');
    try {
      const res = await challengeEngine.moderateEntries(ids, status);
      const okIds = (res.results || []).filter((r) => r.ok).map((r) => r.entry_id);
      setEntries((prev) => prev.map((e) => (okIds.includes(e.id) ? { ...e, status } : e)));
      setSelected([]);
      const failures = (res.results || []).filter((r) => !r.ok);
      setBulkResult(
        failures.length
          ? `${okIds.length} updated, ${failures.length} skipped: ${failures.map((f) => f.error).join('; ')}`
          : `${okIds.length} updated.`
      );
    } catch (e) {
      setError(e.message || 'Bulk update failed');
    } finally {
      setBulkBusy(false);
    }
  };

  const counts = FILTERS.reduce((m, f) => ({ ...m, [f.id]: entries.filter((e) => e.status === f.id).length }), {});
  const shown = entries.filter((e) => e.status === filter);

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h3 className="font-heading text-base font-bold">Entry moderation</h3>
      <div className="mt-3 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => { setFilter(f.id); setSelected([]); setBulkResult(''); }}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${filter === f.id ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground hover:bg-secondary'}`}
          >
            {f.label} ({counts[f.id] || 0})
          </button>
        ))}
      </div>

      {error && <p className="mt-3 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive" role="alert">{error}</p>}

      {loading ? (
        <div className="py-8 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : shown.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">No {filter} entries.</p>
      ) : (
        <>
        <EntryBulkActionBar
          filter={filter}
          busy={bulkBusy}
          count={shown.filter((e) => selected.includes(e.id)).length}
          allSelected={shown.length > 0 && shown.every((e) => selected.includes(e.id))}
          onToggleAll={() => {
            const ids = shown.map((e) => e.id);
            const all = ids.every((id) => selected.includes(id));
            setSelected(all ? [] : ids);
          }}
          onAction={bulkModerate}
        />
        {bulkResult && <p className="mt-2 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">{bulkResult}</p>}
        <ul className="mt-4 space-y-3">
          {shown.map((entry) => (
            <EntryModerationRow key={entry.id} entry={entry} busy={busyId === entry.id || bulkBusy} selected={selected.includes(entry.id)} onToggleSelect={toggleSelect}>
              {filter !== 'approved' && (
                <Button size="sm" disabled={busyId === entry.id} onClick={() => moderate(entry, 'approved')}>
                  <Check className="mr-1 h-3 w-3" /> Approve
                </Button>
              )}
              {filter !== 'rejected' && (
                <Button size="sm" variant="outline" disabled={busyId === entry.id} onClick={() => moderate(entry, 'rejected')}>
                  <X className="mr-1 h-3 w-3" /> Reject
                </Button>
              )}
              {filter !== 'pending' && (
                <Button size="sm" variant="ghost" disabled={busyId === entry.id} onClick={() => moderate(entry, 'pending')}>
                  <RotateCcw className="mr-1 h-3 w-3" /> Reset
                </Button>
              )}
            </EntryModerationRow>
          ))}
        </ul>
        </>
      )}
    </div>
  );
}
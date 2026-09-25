import { useState } from 'react';
import { formatAdded, REASON_TONE, reasonLabel } from './exclusionsMeta';
import { adminChallengeApi } from '@/lib/adminChallengeApi';

export default function ExclusionsTable({ exclusions = [], onRemoved }) {
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');

  const remove = async (row) => {
    setBusyId(row.id);
    setError('');
    try {
      await adminChallengeApi.removeExclusion({ id: row.id });
      onRemoved?.(row);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId('');
    }
  };

  return (
    <>
      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
      <div className="mt-4 overflow-x-auto rounded-2xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Reason</th>
              <th className="px-4 py-3">Added by</th>
              <th className="px-4 py-3">Added</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {exclusions.map((row) => (
              <tr key={row.id} className="border-t border-border">
                <td className="px-4 py-3 font-semibold">{row.email}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${REASON_TONE[row.reason] || 'bg-muted text-muted-foreground'}`}>
                    {reasonLabel(row.reason)}
                  </span>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{row.added_by || '—'}</td>
                <td className="px-4 py-3 text-muted-foreground">{formatAdded(row.date_added)}</td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => remove(row)}
                    disabled={busyId === row.id}
                    className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted disabled:opacity-50"
                  >
                    {busyId === row.id ? 'Removing…' : 'Remove'}
                  </button>
                </td>
              </tr>
            ))}
            {exclusions.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">Nobody is on the exclusion list yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
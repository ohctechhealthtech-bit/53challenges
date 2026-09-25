import { useCallback, useEffect, useState } from 'react';
import { adminChallengeApi } from '@/lib/adminChallengeApi';
import { APPLICATION_STATUSES, APPLICATION_LABELS, canDecideApplication, disciplineList, formatDate, levelLabel } from './judgeMeta';
import JudgeApplicationDialog from './JudgeApplicationDialog';

export default function JudgeApplicationsPanel({ onCounts, onDecided }) {
  const [status, setStatus] = useState('pending');
  const [rows, setRows] = useState([]);
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openRow, setOpenRow] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await adminChallengeApi.judgeApplications({ status });
      setRows(data.applications || []);
      setCounts(data.counts || {});
      if (status === 'pending') onCounts?.(data.unread_count ?? data.count ?? 0);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [status, onCounts]);

  useEffect(() => { load(); }, [load]);

  return (
    <section className="mt-5 rounded-2xl border border-border bg-card/60 p-5">
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="font-heading text-base font-bold">Judge applications</h3>
        <label htmlFor="jap-status" className="sr-only">Application status</label>
        <select id="jap-status" className="c53-input w-48" value={status} onChange={(e) => setStatus(e.target.value)}>
          {APPLICATION_STATUSES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}{counts[s.value] != null ? ` (${counts[s.value]})` : ''}
            </option>
          ))}
        </select>
      </div>

      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}

      {loading ? (
        <p className="mt-4 text-sm text-muted-foreground">Loading applications…</p>
      ) : rows.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">No applications in this view.</p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Applicant</th>
                <th className="px-4 py-3">State</th>
                <th className="px-4 py-3">Expertise</th>
                <th className="px-4 py-3">Level</th>
                <th className="px-4 py-3">Submitted</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => (
                <tr key={a.id} className="border-t border-border align-top">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 font-semibold">
                      {!a.is_read && <span className="h-2 w-2 rounded-full bg-primary" aria-label="Unread" />}
                      {a.full_name || '—'}
                    </div>
                    <div className="text-xs text-muted-foreground">{a.email}</div>
                  </td>
                  <td className="px-4 py-3">{a.state || '—'}</td>
                  <td className="max-w-[240px] px-4 py-3 text-muted-foreground">{disciplineList(a.categories)}</td>
                  <td className="px-4 py-3">{levelLabel(a.level)}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {formatDate(a.submitted_at)}
                    {a.age_days != null && <div className="text-xs">{a.age_days} days ago</div>}
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold">
                      {APPLICATION_LABELS[a.status] || a.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => setOpenRow(a)}
                      className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted"
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {openRow && (
        <JudgeApplicationDialog
          open={!!openRow}
          onOpenChange={(v) => !v && setOpenRow(null)}
          row={openRow}
          canDecide={canDecideApplication(openRow.status)}
          onDecided={async () => {
            setOpenRow(null);
            await load();
            onDecided?.();
          }}
        />
      )}
    </section>
  );
}
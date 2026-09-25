/**
 * "My challenge requests" — every request this host has sent us, with its
 * current status. Open requests can be viewed and edited; approved ones open
 * read-only.
 */
import { useCallback, useEffect, useState } from 'react';
import { Loader2, FileText, Pencil, Eye, Lock } from 'lucide-react';
import { hostRequests } from '@/lib/hostRequestsClient';
import { isRequestEditable, statusLabel } from '@/lib/hostRequestOptions';
import HostRequestDialog from './HostRequestDialog';

export default function MyHostRequestsPanel() {
  const [requests, setRequests] = useState(null);
  const [error, setError] = useState('');
  const [openId, setOpenId] = useState(null);

  const load = useCallback(() => {
    hostRequests('my_requests')
      .then((d) => setRequests(d.requests || []))
      .catch((e) => { setError(e?.message || ''); setRequests([]); });
  }, []);

  useEffect(() => { load(); }, [load]);

  if (requests === null) {
    return (
      <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
    );
  }
  if (error || requests.length === 0) return null;

  return (
    <section className="mt-10">
      <h2 className="flex items-center gap-2 font-heading text-xl font-bold">
        <FileText className="h-5 w-5 text-primary" aria-hidden="true" /> My challenge requests
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Everything you've sent us. You can keep editing a request until we approve it.
      </p>

      <ul className="mt-5 space-y-3">
        {requests.map((r) => {
          const editable = isRequestEditable(r.status);
          return (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-card p-5">
              <div className="min-w-0">
                <p className="truncate font-semibold text-foreground">{r.challenge_title || 'Untitled request'}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {r.company_name}
                  {r.start_date && <> · {r.start_date} → {r.end_date || '—'}</>}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${editable ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'}`}>
                  {!editable && <Lock className="h-3 w-3" />} {statusLabel(r.status)}
                </span>
                <button
                  type="button" onClick={() => setOpenId(r.id)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-border px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted"
                >
                  {editable ? <><Pencil className="h-3.5 w-3.5" /> View &amp; edit</> : <><Eye className="h-3.5 w-3.5" /> View</>}
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      <HostRequestDialog
        requestId={openId}
        open={!!openId}
        onClose={() => setOpenId(null)}
        onSaved={load}
      />
    </section>
  );
}
/**
 * View (and, while it is still open, edit) one of the host's own requests.
 * Once a request is approved it opens read-only with a clear notice.
 */
import { useEffect, useState } from 'react';
import { Loader2, Lock, CheckCircle2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { hostRequests } from '@/lib/hostRequestsClient';
import { isRequestEditable, statusLabel } from '@/lib/hostRequestOptions';
import HostRequestFields from './HostRequestFields';

export default function HostRequestDialog({ requestId, open, onClose, onSaved }) {
  const [form, setForm] = useState(null);
  const [status, setStatus] = useState('new');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!open || !requestId) return;
    setForm(null); setError(''); setSaved(false);
    hostRequests('get_request', { id: requestId })
      .then((d) => { setForm(d.request); setStatus(d.request?.status || 'new'); })
      .catch((e) => setError(e?.message || 'Could not open this request'));
  }, [open, requestId]);

  const readOnly = !isRequestEditable(status);
  const set = (k, v) => { setSaved(false); setForm((f) => ({ ...f, [k]: v })); };

  const save = async () => {
    setError(''); setSaving(true);
    try {
      const d = await hostRequests('update_request', { id: requestId, patch: form });
      setForm(d.request);
      setSaved(true);
      onSaved?.();
    } catch (e) {
      setError(e?.message || 'Could not save your changes');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{readOnly ? 'Your challenge request' : 'View & edit your request'}</DialogTitle>
          <DialogDescription>
            Status: <span className="font-semibold text-foreground">{statusLabel(status)}</span>
          </DialogDescription>
        </DialogHeader>

        {!form && !error && (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        )}

        {form && (
          <>
            {readOnly && (
              <div className="flex gap-3 rounded-2xl border border-border bg-muted/40 p-4">
                <Lock className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {status === 'approved' ? 'This request is locked because it has been approved' : 'This request is closed'}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {status === 'approved'
                      ? "Your request has been approved and is being prepared, so the details can't be changed here any more. If something needs to change, just reply to our last email and we'll sort it out with you."
                      : "This request is no longer open for changes. Get in touch if you'd like to revisit it."}
                  </p>
                </div>
              </div>
            )}

            <HostRequestFields form={form} set={set} readOnly={readOnly} />

            {error && <p className="text-sm font-medium text-destructive" role="alert">{error}</p>}

            <div className="flex items-center justify-end gap-3 border-t border-border pt-4">
              {saved && (
                <span className="flex items-center gap-1.5 text-sm font-medium text-success">
                  <CheckCircle2 className="h-4 w-4" /> Changes saved
                </span>
              )}
              <button type="button" onClick={onClose} className="rounded-xl border border-border px-5 py-2.5 text-sm font-semibold text-foreground hover:bg-muted">
                Close
              </button>
              {!readOnly && (
                <button
                  type="button" onClick={save} disabled={saving}
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-60"
                >
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />} Save changes
                </button>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
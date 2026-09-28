import { safeExternalUrl } from '@/lib/safeUrl';
import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { adminChallengeApi } from '@/lib/adminChallengeApi';
import { LEVELS, APPLICATION_LABELS, disciplineList, formatDate, levelLabel } from './judgeMeta';

export default function JudgeApplicationDialog({ open, onOpenChange, row, canDecide, onDecided }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [level, setLevel] = useState(row?.level || 'state');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const d = await adminChallengeApi.judgeApplication({ id: row.id });
        if (!cancelled) setDetail(d);
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [row.id]);

  const app = detail?.application || detail?.row || row;
  const works = detail?.works || [];

  const decide = async (decision) => {
    setBusy(decision);
    setError('');
    try {
      await adminChallengeApi.decideJudgeApplication({
        id: row.id,
        decision,
        ...(decision === 'approved' ? { level } : {}),
        ...(reason.trim() ? { reason: reason.trim() } : {}),
      });
      onDecided?.();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy('');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{app.full_name || 'Judge application'}</DialogTitle>
          <DialogDescription>
            {APPLICATION_LABELS[app.status] || app.status} · submitted {formatDate(app.submitted_at)}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading the application…</p>
        ) : (
          <div className="space-y-4 text-sm">
            <dl className="grid gap-3 rounded-xl border border-border p-4 sm:grid-cols-2">
              <Field label="Email" value={app.email} />
              <Field label="Phone" value={app.phone} />
              <Field label="State" value={app.state} />
              <Field label="Requested level" value={levelLabel(app.level)} />
              <Field label="Expertise" value={disciplineList(app.categories)} />
              <Field label="Availability" value={(app.availability || []).join(', ')} />
              {app.decision_reason && <Field label="Decision reason" value={app.decision_reason} />}
              {app.decided_at && <Field label="Decided" value={formatDate(app.decided_at)} />}
            </dl>

            {works.length > 0 && (
              <div>
                <h4 className="mb-2 font-heading text-sm font-bold">Portfolio ({works.length})</h4>
                <ul className="space-y-1.5">
                  {works.map((w, i) => (
                    <li key={w.id || i} className="rounded-lg border border-border px-3 py-2">
                      <span className="font-semibold">{w.title || w.name || `Work ${i + 1}`}</span>
                      {(w.link || w.work_link || w.url) && (
                        <a href={safeExternalUrl(w.link || w.work_link || w.url)} target="_blank" rel="noreferrer" className="ml-2 text-primary underline">Open</a>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {canDecide && (
              <div className="space-y-3 rounded-xl border border-border p-4">
                <div>
                  <label htmlFor="jad-level" className="mb-1.5 block text-sm font-semibold">Level to grant on acceptance</label>
                  <select id="jad-level" className="c53-input" value={level} onChange={(e) => setLevel(e.target.value)}>
                    {LEVELS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="jad-reason" className="mb-1.5 block text-sm font-semibold">Reason (shared if you reject)</label>
                  <textarea id="jad-reason" className="c53-input min-h-[80px]" value={reason} onChange={(e) => setReason(e.target.value)} />
                </div>
              </div>
            )}

            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          <Button variant="destructive" disabled={!canDecide || !!busy} onClick={() => decide('rejected')}>
            {busy === 'rejected' ? 'Rejecting…' : 'Reject'}
          </Button>
          <Button disabled={!canDecide || !!busy} onClick={() => decide('approved')}>
            {busy === 'approved' ? 'Accepting…' : 'Accept'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, value }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 break-words font-medium">{value || '—'}</dd>
    </div>
  );
}
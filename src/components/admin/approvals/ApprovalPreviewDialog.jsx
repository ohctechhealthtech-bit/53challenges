import { safeExternalUrl } from '@/lib/safeUrl';
import { useEffect, useState } from 'react';
import { Loader2, ExternalLink } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { adminChallengeApi } from '@/lib/adminChallengeApi';
import ApprovalActionButtons from '@/components/admin/approvals/ApprovalActionButtons';
import { REVIEW_LABELS, fmtDate } from '@/components/admin/approvals/approvalMeta';

const HIDE = new Set(['id', 'created_by_id', 'created_by', 'is_sample', 'updated_date', 'created_date']);

function label(k) {
  return k.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function ApprovalPreviewDialog({ open, onOpenChange, entryId, row, busy, onApprove, onReject }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open || !entryId) return;
    setLoading(true);
    setError('');
    adminChallengeApi
      .getApproval({ id: entryId })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [open, entryId]);

  const entry = data?.entry || {};
  const challenge = data?.challenge || {};
  const media = entry.work_url || '';
  const isImage = ['image', 'photo'].includes(entry.media_type);
  const isVideo = entry.media_type === 'video';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{row?.title || entry.title || 'Entry preview'}</DialogTitle>
        </DialogHeader>

        {loading ? (
          <p className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading entry…
          </p>
        ) : error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="rounded-full bg-primary/15 px-2.5 py-1 text-xs font-bold text-primary">
                {REVIEW_LABELS[entry.status] || entry.status}
              </span>
              <span className="text-muted-foreground">
                {challenge.title || entry.challenge_title} · Submitted {fmtDate(entry.submitted_at)}
              </span>
            </div>

            {media && (
              <div className="overflow-hidden rounded-xl border border-border bg-muted">
                {isVideo ? (
                  <video src={media} controls className="max-h-[380px] w-full" />
                ) : isImage ? (
                  <img src={media} alt="" className="max-h-[380px] w-full object-contain" />
                ) : (
                  <a href={safeExternalUrl(media)} target="_blank" rel="noreferrer" className="flex items-center gap-2 p-4 text-sm font-semibold text-primary">
                    <ExternalLink className="h-4 w-4" /> Open submitted work
                  </a>
                )}
              </div>
            )}

            {entry.description && (
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Description</p>
                <p className="mt-1 whitespace-pre-wrap text-sm">{entry.description}</p>
              </div>
            )}

            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Entry record</p>
              <dl className="mt-2 grid gap-x-6 gap-y-3 rounded-xl border border-border bg-muted/40 p-4 sm:grid-cols-2">
                {Object.entries(entry)
                  .filter(([k, v]) => !HIDE.has(k) && v !== null && v !== '' && typeof v !== 'object')
                  .map(([k, v]) => (
                    <div key={k}>
                      <dt className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{label(k)}</dt>
                      <dd className="text-sm break-words">{typeof v === 'boolean' ? (v ? 'Yes' : 'No') : String(v)}</dd>
                    </div>
                  ))}
              </dl>
            </div>

            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Challenge</p>
              <dl className="mt-2 grid gap-x-6 gap-y-3 rounded-xl border border-border bg-muted/40 p-4 sm:grid-cols-2">
                {Object.entries(challenge)
                  .filter(([, v]) => v !== null && v !== '' && typeof v !== 'object')
                  .map(([k, v]) => (
                    <div key={k}>
                      <dt className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{label(k)}</dt>
                      <dd className="text-sm break-words">{String(v)}</dd>
                    </div>
                  ))}
              </dl>
            </div>

            <ApprovalActionButtons
              row={data?.row || entry}
              busy={busy}
              onPreview={() => {}}
              onApprove={() => onApprove(data?.row || { ...entry, review_state: entry.status })}
              onReject={() => onReject(data?.row || { ...entry, review_state: entry.status })}
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
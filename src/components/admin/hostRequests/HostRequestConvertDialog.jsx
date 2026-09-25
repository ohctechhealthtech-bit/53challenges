import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import ChallengeFormDialog from '@/components/admin/ChallengeFormDialog';
import { adminChallengeApi } from '@/lib/adminChallengeApi';

// Prefill comes from hostRequests.convertPrefill; the full Add-challenge form
// is reused for editing, and the resulting payload is sent as overrides to
// hostRequests.convert.
export default function HostRequestConvertDialog({ open, onOpenChange, requestId, onConverted }) {
  const [prefill, setPrefill] = useState(null);
  const [reference, setReference] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setError('');
    Promise.all([
      adminChallengeApi.hostRequestConvertPrefill({ id: requestId }),
      adminChallengeApi.reference().catch(() => ({})),
    ])
      .then(([d, ref]) => {
        if (cancelled) return;
        const p = d.prefill || d;
        setPrefill({ ...p, id: undefined });
        setReference(ref?.reference || ref || {});
      })
      .catch((e) => !cancelled && setError(e.message));
    return () => { cancelled = true; };
  }, [requestId]);

  if (!prefill) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Convert to challenge</DialogTitle>
          </DialogHeader>
          {error
            ? <p className="py-6 text-sm text-destructive">{error}</p>
            : <p className="py-6 text-center text-sm text-muted-foreground">Loading prefill…</p>}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <ChallengeFormDialog
      open={open}
      onOpenChange={onOpenChange}
      challenge={prefill}
      categories={reference?.categories || []}
      reference={reference}
      titleText="Convert to challenge"
      submitLabel="Create challenge"
      intro="Prefilled from this request. Adjust anything before creating the challenge."
      onSubmit={(payload) => adminChallengeApi.hostRequestConvert({ id: requestId, challenge: payload })}
      onSaved={onConverted}
    />
  );
}
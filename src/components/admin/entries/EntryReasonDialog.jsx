import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

// Reject or block needs a reason, and the entrant is told what it says.
export default function EntryReasonDialog({ open, onOpenChange, decision, entry, busy, onConfirm }) {
  const [reason, setReason] = useState('');
  const blocking = decision === 'block';

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) setReason(''); onOpenChange(v); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {blocking ? 'Block' : 'Reject'} “{entry?.title || 'this entry'}”
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          {blocking
            ? 'Blocking hides the entry from everyone. Record why, for the audit trail.'
            : 'The entrant is told why their entry wasn\u2019t accepted, so keep it clear and kind.'}
        </p>
        {entry?.entry_fee_paid > 0 && !blocking && (
          <p className="text-sm text-gold">This entry was paid for, so rejecting it raises a refund for review.</p>
        )}
        <label htmlFor="entry-reason" className="mt-2 text-sm font-semibold">Reason</label>
        <textarea
          id="entry-reason"
          className="c53-input min-h-[110px]"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={blocking ? 'What makes this entry unsafe or unusable?' : 'Explain what needs to change'}
        />
        <div className="mt-3 flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="destructive" disabled={!reason.trim() || !!busy} onClick={() => onConfirm(reason.trim())}>
            {busy ? 'Working…' : blocking ? 'Block entry' : 'Reject entry'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
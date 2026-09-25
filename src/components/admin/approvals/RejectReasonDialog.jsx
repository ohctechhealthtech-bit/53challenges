import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

export default function RejectReasonDialog({ open, onOpenChange, row, busy, onConfirm }) {
  const [reason, setReason] = useState('');

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) setReason(''); onOpenChange(v); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Reject “{row?.title || 'this entry'}”</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          The entrant is told why their entry wasn't accepted, so keep it clear and kind.
        </p>
        <label htmlFor="reject-reason" className="mt-2 text-sm font-semibold">Reason</label>
        <textarea
          id="reject-reason"
          className="c53-input min-h-[110px]"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Explain what needs to change"
        />
        <div className="mt-3 flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="destructive" disabled={!reason.trim() || !!busy} onClick={() => onConfirm(reason.trim())}>
            Reject entry
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
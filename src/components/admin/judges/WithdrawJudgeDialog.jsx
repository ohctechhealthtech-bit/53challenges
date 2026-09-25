import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

export default function WithdrawJudgeDialog({ open, onOpenChange, row, busy, onConfirm }) {
  const [reason, setReason] = useState('');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Withdraw {row?.judge_name || 'this judge'}?</DialogTitle>
          <DialogDescription>
            The invitation is cancelled and they come off the panel. Nothing is deleted, and the change is recorded.
          </DialogDescription>
        </DialogHeader>
        <div>
          <label htmlFor="wd-reason" className="mb-1.5 block text-sm font-semibold">Reason (optional)</label>
          <textarea
            id="wd-reason"
            className="c53-input min-h-[90px]"
            placeholder="Why are they coming off the panel?"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="destructive" disabled={busy} onClick={() => onConfirm(reason.trim())}>
            {busy ? 'Withdrawing…' : 'Withdraw judge'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
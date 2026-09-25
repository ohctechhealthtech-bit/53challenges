import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

// Generic confirm dialog for a stage or season action. The parent enforces
// its own guards — any refusal is shown inline.
export default function StageActionDialog({ open, onOpenChange, action, withReason, run, onDone, canConfirm = true, children }) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    setError('');
    try {
      await run(reason.trim());
      await onDone();
    } catch (e) {
      setError(e.message);
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{action.label}</DialogTitle>
          <DialogDescription>
            {action.confirm || 'This is recorded in the challenge audit log and cannot be undone from here.'}
          </DialogDescription>
        </DialogHeader>

        {children}

        {withReason && (
          <div>
            <label htmlFor="sa-reason" className="mb-1.5 block text-sm font-semibold">Reason (optional)</label>
            <textarea id="sa-reason" className="c53-input min-h-[80px]" value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={saving || !canConfirm}>{saving ? 'Working…' : 'Confirm'}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
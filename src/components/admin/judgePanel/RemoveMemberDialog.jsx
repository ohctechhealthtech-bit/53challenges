import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { adminChallengeApi } from '@/lib/adminChallengeApi';

export default function RemoveMemberDialog({ open, onOpenChange, challengeId, member, actingEmail, onRemoved }) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    setError('');
    try {
      await adminChallengeApi.judgePanelRemove({
        challengeId,
        assignmentId: member.id,
        judgeEmail: member.judge_email,
        reason: reason.trim(),
        actingEmail,
      });
      onRemoved?.();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Remove from the panel</DialogTitle>
          <DialogDescription>
            {member?.display_name || member?.judge_email} stops judging this challenge. Their invitation is cancelled, never deleted, and the removal is logged.
          </DialogDescription>
        </DialogHeader>

        <div>
          <label htmlFor="rm-reason" className="mb-1.5 block text-sm font-semibold">Reason (optional)</label>
          <textarea id="rm-reason" className="c53-input min-h-[90px]" value={reason} onChange={(e) => setReason(e.target.value)} />
          {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="destructive" onClick={submit} disabled={saving}>{saving ? 'Removing…' : 'Remove judge'}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
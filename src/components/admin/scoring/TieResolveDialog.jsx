import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { adminChallengeApi } from '@/lib/adminChallengeApi';

export default function TieResolveDialog({ open, onOpenChange, challengeId, row, actingEmail, onResolved }) {
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (note.trim().length < 5) { setError('Write at least 5 characters — this reason goes in the audit log.'); return; }
    setSaving(true);
    setError('');
    try {
      await adminChallengeApi.resolveScoringTie({ challengeId, entryId: row.entry_id, note: note.trim(), actingEmail });
      onResolved?.();
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
          <DialogTitle>Chief judge decision</DialogTitle>
          <DialogDescription>{row?.title} becomes the chief judge pick and the tie flag clears on its group.</DialogDescription>
        </DialogHeader>

        <div>
          <label htmlFor="tie-note" className="mb-1.5 block text-sm font-semibold">Reason for the decision</label>
          <textarea id="tie-note" className="c53-input min-h-[100px]" value={note} onChange={(e) => setNote(e.target.value)} />
          <p className="mt-1 text-xs text-muted-foreground">{note.trim().length} characters · minimum 5</p>
          {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={saving || note.trim().length < 5}>{saving ? 'Recording…' : 'Record decision'}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
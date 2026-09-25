import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { adminChallengeApi } from '@/lib/adminChallengeApi';

export default function DeleteSponsorDialog({ sponsor, actingEmail, onClose, onDeleted }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const remove = async () => {
    setBusy(true);
    setError('');
    try {
      await adminChallengeApi.deleteSponsor({ id: sponsor.id, actingEmail });
      onDeleted();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={Boolean(sponsor)} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Delete {sponsor?.name}?</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">
          This removes the sponsor and their ads for good. If you only want them off the public pages, hide them instead.
        </p>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Keep sponsor</Button>
          <Button variant="destructive" onClick={remove} disabled={busy}>{busy ? 'Deleting…' : 'Delete sponsor'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
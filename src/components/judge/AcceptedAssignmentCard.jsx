// An accepted judging assignment: entry counts, the one-time conflict
// declaration, a way into judging, and cancel-with-confirmation.
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Gavel, ShieldAlert } from 'lucide-react';
import { pickNum } from '@/lib/judgeApi';
import { isAttested } from '@/lib/judgeAttestation';
import AttestationGate from '@/components/judge/AttestationGate';

export default function AcceptedAssignmentCard({ row, scopeKey, onRespond, onJudge }) {
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [gateOpen, setGateOpen] = useState(false);
  const attested = isAttested(scopeKey);

  const entries = pickNum(row, ['entry_count', 'entries', 'entries_total', 'total'], 0);
  const scored = pickNum(row, ['scored', 'entries_scored', 'my_scored'], 0);
  const remaining = Math.max(entries - scored, 0);
  const due = row.due_date || row.deadline || '';

  const cancel = async () => {
    setBusy(true);
    await onRespond(row, 'declined');
    setBusy(false);
    setConfirmOpen(false);
  };

  return (
    <div className="space-y-4 rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-heading font-bold">
          {row.challenge?.title || row.challenge_title || row.round_title || row.title || 'Challenge'}
        </h3>
        <Badge className="border-success/40 bg-success/15 text-success">Accepted</Badge>
        {row.category && <Badge variant="outline" className="text-xs capitalize">{String(row.category).replace(/[_-]/g, ' ')}</Badge>}
        {due && (
          <span className="text-xs text-muted-foreground">
            Due {new Date(due).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}
          </span>
        )}
        <div className="flex-1" />
        <Button size="sm" variant="outline" className="border-destructive/40 text-destructive" onClick={() => setConfirmOpen(true)}>
          Cancel assignment
        </Button>
      </div>

      {!attested && !gateOpen && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-gold/40 bg-gold/10 p-4">
          <ShieldAlert className="h-5 w-5 shrink-0 text-gold" />
          <p className="flex-1 text-sm">
            A conflict-of-interest declaration is required once before you can score this challenge's entries.
          </p>
          <Button size="sm" onClick={() => setGateOpen(true)}>Complete declaration</Button>
        </div>
      )}

      {gateOpen && (
        <AttestationGate
          scopeKey={scopeKey}
          onDone={() => { setGateOpen(false); onJudge?.(row); }}
          onCancel={() => setGateOpen(false)}
        />
      )}

      {entries === 0 ? (
        <p className="text-sm text-muted-foreground">No entries available to score yet.</p>
      ) : (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-secondary p-4">
          <p className="flex-1 text-sm">
            {entries} entr{entries === 1 ? 'y' : 'ies'} ready to judge
            {' · '}
            <span className="font-semibold">{remaining} still to score</span>
          </p>
          <Button
            size="sm"
            onClick={() => (attested ? onJudge?.(row) : setGateOpen(true))}
          >
            <Gavel className="h-4 w-4" /> Judge entries
          </Button>
        </div>
      )}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this judging assignment?</AlertDialogTitle>
            <AlertDialogDescription>
              You will no longer be able to score entries for this challenge. Scores you've already submitted are kept
              for audit, and the organisers will be notified.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep assignment</AlertDialogCancel>
            <AlertDialogAction disabled={busy} onClick={cancel} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Yes, cancel it
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
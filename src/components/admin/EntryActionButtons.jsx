import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { adminChallengeApi } from '@/lib/adminChallengeApi';
import EntryReasonDialog from '@/components/admin/entries/EntryReasonDialog';

// Which decisions apply to an entry's current moderation state, matching the
// parent admin UI: a blocked entry can only be unblocked, and no state offers
// the decision it is already in.
function allowedDecisions(state) {
  switch (state) {
    case 'blocked': return ['unblock'];
    case 'approved': return ['reject', 'block'];
    case 'rejected': return ['approve', 'block'];
    default: return ['approve', 'reject', 'block'];
  }
}

const VARIANTS = { approve: 'default', reject: 'destructive', block: 'destructive', unblock: 'outline' };

export default function EntryActionButtons({ entry, actingEmail, onDone }) {
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [askReason, setAskReason] = useState('');

  const state = entry.moderation_state || entry.status || 'pending';
  const decisions = allowedDecisions(state);
  // The parent disables moderation while a guardian approval is still pending.
  const lockedReason = entry.guardian_approval_status === 'pending' ? 'Waiting on guardian approval' : '';

  const start = (decision) => {
    if (decision === 'reject' || decision === 'block') { setAskReason(decision); return; }
    act(decision);
  };

  const act = async (decision, reason = '') => {
    setBusy(decision);
    setError('');
    try {
      await adminChallengeApi.updateEntry({
        entryId: entry.id,
        decision,
        ...(reason ? { reason } : {}),
        actingEmail,
      });
      setAskReason('');
      onDone?.();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {decisions.map((d) => (
        <Button
          key={d}
          size="sm"
          variant={VARIANTS[d]}
          className="capitalize"
          disabled={!!busy || !!lockedReason}
          title={lockedReason || undefined}
          onClick={() => start(d)}
        >
          {busy === d && <Loader2 className="h-3.5 w-3.5 animate-spin" />} {d}
        </Button>
      ))}
      {lockedReason && <span className="text-xs text-muted-foreground">{lockedReason}</span>}
      {error && <span className="text-xs text-destructive">{error}</span>}

      {askReason && (
        <EntryReasonDialog
          open={!!askReason}
          onOpenChange={(v) => !v && setAskReason('')}
          decision={askReason}
          entry={entry}
          busy={busy === askReason}
          onConfirm={(reason) => act(askReason, reason)}
        />
      )}
    </div>
  );
}
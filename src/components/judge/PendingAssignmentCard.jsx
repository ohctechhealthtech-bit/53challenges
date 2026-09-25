// A judging invitation awaiting the judge's accept / decline.
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Check, X, Loader2 } from 'lucide-react';

export default function PendingAssignmentCard({ row, onRespond }) {
  const [busy, setBusy] = useState(false);

  const respond = async (response) => {
    setBusy(true);
    await onRespond(row, response);
    setBusy(false);
  };

  return (
    <div className="rounded-2xl border border-gold/40 bg-card p-5">
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <h3 className="font-heading font-bold">
          {row.challenge?.title || row.challenge_title || row.round_title || row.title || 'Challenge'}
        </h3>
        <Badge className="border-gold/40 bg-gold/15 text-gold">Awaiting your response</Badge>
        {row.stage && <Badge variant="outline" className="text-xs capitalize">{String(row.stage).replace(/[_-]/g, ' ')}</Badge>}
        {row.category && <Badge variant="outline" className="text-xs capitalize">{String(row.category).replace(/[_-]/g, ' ')}</Badge>}
      </div>
      <p className="mb-4 text-sm text-muted-foreground">
        You've been asked to judge this challenge. Accepting unlocks its entries for scoring.
      </p>
      <div className="flex gap-2">
        <Button size="sm" disabled={busy} onClick={() => respond('accepted')}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Accept
        </Button>
        <Button size="sm" variant="outline" disabled={busy} onClick={() => respond('declined')} className="border-destructive/40 text-destructive">
          <X className="h-4 w-4" /> Decline
        </Button>
      </div>
    </div>
  );
}
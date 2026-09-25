// Conflict-of-interest attestation — confirmed ONCE per assignment, in the
// Assignments tab (see @/lib/judgeAttestation). After that, every entry in
// that challenge opens straight into scoring.
import { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { setAttested } from '@/lib/judgeAttestation';

export default function AttestationGate({ scopeKey, onDone, onCancel }) {
  const [checked, setChecked] = useState(false);

  return (
    <div className="rounded-xl border border-gold/40 bg-gold/10 p-4 text-sm">
      <p className="flex items-center gap-2 font-semibold">
        <ShieldCheck className="h-4 w-4 text-gold" /> Conflict-of-interest attestation
      </p>
      <p className="mt-1 text-muted-foreground">
        Before you start judging this challenge, please confirm you have no personal, professional or
        financial relationship with any entrant that could affect your judgement.
      </p>
      <label className="mt-3 flex items-start gap-2">
        <input
          type="checkbox"
          className="mt-0.5 h-4 w-4"
          checked={checked}
          onChange={(e) => setChecked(e.target.checked)}
        />
        <span>I confirm I have no conflict of interest in this challenge, and I will judge fairly and independently.</span>
      </label>
      <div className="mt-3 flex gap-2">
        <Button
          size="sm"
          disabled={!checked}
          onClick={() => { setAttested(scopeKey); onDone?.(); }}
        >
          Confirm and start judging
        </Button>
        {onCancel && (
          <Button size="sm" variant="outline" onClick={onCancel}>Cancel</Button>
        )}
      </div>
    </div>
  );
}
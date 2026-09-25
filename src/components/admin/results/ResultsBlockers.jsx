import { AlertTriangle, CheckCircle2 } from 'lucide-react';

// Nothing can be approved or published while a tie is unresolved or an entry is
// flagged, and the winner stays provisional until the scrutineer signs off.
export default function ResultsBlockers({ rows = [], signedOff }) {
  const ties = rows.filter((r) => r.tie_break_pending);
  const flagged = rows.filter((r) => r.integrity_status === 'flagged');
  const clear = !ties.length && !flagged.length && signedOff;

  if (clear) {
    return (
      <p className="mt-4 flex items-center gap-2 rounded-xl border border-success/40 bg-success/10 px-4 py-3 text-sm text-success">
        <CheckCircle2 className="h-4 w-4" /> Nothing is blocking these results — they can be approved and published from Stage &amp; config.
      </p>
    );
  }

  return (
    <div className="mt-4 rounded-xl border border-gold/40 bg-gold/10 px-4 py-3 text-sm">
      <p className="flex items-center gap-2 font-semibold text-gold">
        <AlertTriangle className="h-4 w-4" /> Sort these out before approving or publishing
      </p>
      <ul className="mt-2 space-y-1 text-muted-foreground">
        {ties.length > 0 && (
          <li>{ties.length} {ties.length === 1 ? 'entry needs' : 'entries need'} a chief judge tie decision: {ties.map((r) => r.title).join(', ')}</li>
        )}
        {flagged.length > 0 && (
          <li>{flagged.length} flagged in the integrity review: {flagged.map((r) => r.title).join(', ')}</li>
        )}
        {!signedOff && <li>The scrutineer hasn&apos;t signed off, so the winner stays provisional.</li>}
      </ul>
    </div>
  );
}
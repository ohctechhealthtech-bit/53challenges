import { useState } from 'react';
import { ShieldCheck, AlertTriangle, Loader2 } from 'lucide-react';
import { auditAction } from '@/lib/audit';

export default function PreLaunchCard({ review, competitionId, onChanged }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const pl = review?.pre_launch || {};

  const run = async () => {
    setBusy(true); setErr('');
    try {
      await auditAction(competitionId, 'pre_launch');
      onChanged();
    } catch (e) { setErr(e.message || 'Failed'); }
    finally { setBusy(false); }
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-blue-400" />
          <h3 className="font-heading text-base font-bold">Pre-launch check</h3>
        </div>
        <button onClick={run} disabled={busy} className="inline-flex items-center gap-1.5 rounded-xl bg-blue-500/15 px-4 py-2 text-sm font-bold text-blue-400 hover:bg-blue-500/25 disabled:opacity-50">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}{pl.checked_at ? 'Re-run' : 'Run check'}
        </button>
      </div>
      {pl.checked_at ? (
        <div className="mt-4">
          <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${pl.terms_match ? 'bg-emerald-500/15 text-emerald-400' : 'bg-destructive/15 text-destructive'}`}>
            {pl.terms_match ? <ShieldCheck className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
            {pl.terms_match ? 'Published terms match configuration' : 'Terms mismatch — resolve before launch'}
          </span>
          {pl.notes && <p className="mt-3 text-sm text-muted-foreground">{pl.notes}</p>}
          <p className="mt-2 text-xs text-muted-foreground">Checked by {pl.checked_by} · {new Date(pl.checked_at).toLocaleString()}</p>
        </div>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">Confirms published brief, dates and category are set; sponsored prize money must be recorded as received before the competition opens.</p>
      )}
      {err && <p className="mt-3 text-sm text-destructive">{err}</p>}
    </div>
  );
}
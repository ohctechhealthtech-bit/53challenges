import { useState } from 'react';
import { ShieldAlert, Check, X, Loader2 } from 'lucide-react';
import { resolveFlag, COMPLIANCE_REASONS } from '@/lib/judgeScoring';

const reasonLabel = (v) => COMPLIANCE_REASONS.find((r) => r.value === v)?.label || v || '—';

export default function ComplianceFlagQueue({ flags, onResolved }) {
  const [busy, setBusy] = useState('');

  const decide = async (flag, decision) => {
    setBusy(flag.id);
    try {
      await resolveFlag(flag.id, decision);
      onResolved?.();
    } finally {
      setBusy('');
    }
  };

  if (!flags.length) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card/50 px-6 py-10 text-center text-sm text-muted-foreground">
        No open compliance flags.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {flags.map((f) => (
        <div key={f.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-sm font-bold">
              <ShieldAlert className="h-4 w-4 text-amber-400" />
              <span className="font-mono">{f.anonymous_id || f.id.slice(0, 6)}</span>
              <span className="text-muted-foreground">· {reasonLabel(f.reason)}</span>
            </p>
            {f.note && <p className="mt-0.5 text-xs text-muted-foreground">{f.note}</p>}
            <p className="mt-0.5 text-xs text-muted-foreground">Raised by {f.judge_name || 'a judge'}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {busy === f.id && <Loader2 className="h-4 w-4 animate-spin" />}
            <button onClick={() => decide(f, 'upheld')} disabled={!!busy}
              className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50">
              <Check className="h-3.5 w-3.5" /> Uphold
            </button>
            <button onClick={() => decide(f, 'dismissed')} disabled={!!busy}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-bold disabled:opacity-50">
              <X className="h-3.5 w-3.5" /> Dismiss
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
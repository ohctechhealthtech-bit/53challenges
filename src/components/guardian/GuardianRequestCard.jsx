import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Check, X, Undo2 } from 'lucide-react';

const STATUS_STYLES = {
  pending: 'bg-amber-500/15 text-amber-300',
  approved: 'bg-emerald-500/15 text-emerald-300',
  declined: 'bg-red-500/15 text-red-300',
  revoked: 'bg-muted text-muted-foreground',
};

export default function GuardianRequestCard({ request, onDecide }) {
  const [mode, setMode] = useState(null); // 'decline' | 'revoke'
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const decide = async (action, r) => {
    setBusy(true);
    try {
      await onDecide(request.id, action, r);
      setMode(null); setReason('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-heading text-sm font-bold">{request.entry_title || 'Entry'}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {request.child_name} · {request.challenge_title || 'Challenge'}
          </p>
        </div>
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_STYLES[request.status] || ''}`}>
          {request.status}
        </span>
      </div>
      {request.decline_reason && <p className="mt-2 text-xs text-muted-foreground">Reason: {request.decline_reason}</p>}

      {mode && (
        <textarea
          className="c53-input mt-3 min-h-[70px]"
          placeholder="Reason (required)"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {request.status === 'pending' && !mode && (
          <>
            <Button size="sm" disabled={busy} onClick={() => decide('approve')}>
              {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Check className="mr-1 h-4 w-4" />} Approve
            </Button>
            <Button size="sm" variant="outline" onClick={() => setMode('decline')}><X className="mr-1 h-4 w-4" /> Decline</Button>
          </>
        )}
        {request.status === 'approved' && !mode && (
          <Button size="sm" variant="outline" onClick={() => setMode('revoke')}><Undo2 className="mr-1 h-4 w-4" /> Revoke consent</Button>
        )}
        {mode && (
          <>
            <Button size="sm" variant="destructive" disabled={busy || !reason.trim()} onClick={() => decide(mode, reason.trim())}>
              {busy && <Loader2 className="mr-1 h-4 w-4 animate-spin" />} Confirm {mode}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setMode(null); setReason(''); }}>Cancel</Button>
          </>
        )}
      </div>
    </div>
  );
}
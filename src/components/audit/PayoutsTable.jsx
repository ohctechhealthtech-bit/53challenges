import { useState } from 'react';
import { Loader2, UserCheck, Gavel, ShieldCheck, Banknote } from 'lucide-react';
import { payoutAction } from '@/lib/audit';

const STATUS_TONE = {
  pending: 'bg-muted text-muted-foreground',
  audited: 'bg-blue-500/15 text-blue-400',
  approved: 'bg-purple-500/15 text-purple-400',
  paid: 'bg-emerald-500/15 text-emerald-400',
};

export default function PayoutsTable({ payouts, isAdmin, onChanged }) {
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const [refs, setRefs] = useState({});

  const act = async (id, action, data = {}) => {
    setBusy(id + ':' + action); setErr('');
    try { await payoutAction(id, action, data); onChanged(); }
    catch (e) { setErr(e.message || 'Failed'); }
    finally { setBusy(''); }
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center gap-2">
        <Banknote className="h-5 w-5 text-emerald-400" />
        <h3 className="font-heading text-base font-bold">Prize payouts · two-person release</h3>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">Pending → Audited (auditor sign-off) → Approved (platform admin) → Paid. Winners verify identity & payment details first; under-18 prizes pay to a guardian.</p>
      {err && <p className="mt-2 text-sm text-destructive">{err}</p>}
      {!payouts.length ? (
        <p className="mt-4 text-sm text-muted-foreground">No payout rows yet — generate from the ledger once the audit is signed off.</p>
      ) : (
        <div className="mt-4 space-y-2">
          {payouts.map((p) => (
            <div key={p.id} className="rounded-xl border border-border bg-white/5 p-3">
              <div className="flex flex-wrap items-center gap-3">
                <span className="grid h-8 w-8 place-items-center rounded-lg grad-bg text-sm font-extrabold text-white">{p.placing}</span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{p.winner_name || 'Winner'} · {p.label}</p>
                  <p className="text-xs text-muted-foreground">${p.amount.toLocaleString()} · {p.payee_type === 'guardian' ? `Guardian: ${p.guardian_name || '—'}` : 'Paid to entrant'} {p.is_minor && '· U18'}</p>
                </div>
                <span className={`ml-auto rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${STATUS_TONE[p.status]}`}>{p.status}</span>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className={p.identity_verified ? 'text-emerald-400' : ''}>Identity {p.identity_verified ? '✓' : '✗'}</span>
                <span className={p.payment_details_verified ? 'text-emerald-400' : ''}>Payment details {p.payment_details_verified ? '✓' : '✗'}</span>
                {p.auditor_signoff_by && <span>Audit: {p.auditor_signoff_name} · {new Date(p.auditor_signoff_at).toLocaleDateString()}</span>}
                {p.admin_approval_by && <span>Approved: {p.admin_approval_name}</span>}
              </div>
              {/* Actions */}
              <div className="mt-3 flex flex-wrap gap-2">
                {p.status === 'pending' && (
                  <>
                    <button onClick={() => act(p.id, 'verify_identity', { payment_details_verified: true, payment_method: isAdmin ? 'bank' : undefined })} disabled={!!busy} className="inline-flex items-center gap-1.5 rounded-lg bg-white/5 px-3 py-1.5 text-xs font-bold hover:bg-muted disabled:opacity-50">
                      {busy === p.id + ':verify_identity' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserCheck className="h-3.5 w-3.5" />} Verify identity & details
                    </button>
                    <button onClick={() => act(p.id, 'auditor_signoff')} disabled={!!busy || !p.identity_verified || !p.payment_details_verified} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-500/15 px-3 py-1.5 text-xs font-bold text-blue-400 hover:bg-blue-500/25 disabled:opacity-50">
                      {busy === p.id + ':auditor_signoff' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Gavel className="h-3.5 w-3.5" />} Auditor sign-off
                    </button>
                  </>
                )}
                {p.status === 'audited' && isAdmin && (
                  <button onClick={() => act(p.id, 'admin_approve')} disabled={!!busy} className="inline-flex items-center gap-1.5 rounded-lg bg-purple-500/15 px-3 py-1.5 text-xs font-bold text-purple-400 hover:bg-purple-500/25 disabled:opacity-50">
                    {busy === p.id + ':admin_approve' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />} Admin approve
                  </button>
                )}
                {p.status === 'approved' && isAdmin && (
                  <div className="flex items-center gap-1.5">
                    <input value={refs[p.id] || ''} onChange={(e) => setRefs({ ...refs, [p.id]: e.target.value })} placeholder="Payment ref" className="w-36 rounded-lg border border-input bg-background/60 px-2 py-1.5 text-xs" />
                    <button onClick={() => act(p.id, 'mark_paid', { payment_ref: refs[p.id] || '' })} disabled={!!busy} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/15 px-3 py-1.5 text-xs font-bold text-emerald-400 hover:bg-emerald-500/25 disabled:opacity-50">
                      {busy === p.id + ':mark_paid' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Banknote className="h-3.5 w-3.5" />} Mark paid
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
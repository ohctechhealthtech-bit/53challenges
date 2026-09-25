import { useState } from 'react';
import { Loader2, CheckCircle2, Circle, Lock, ArrowRight, FileSearch } from 'lucide-react';
import { auditAction, CHECKLIST_ITEMS } from '@/lib/audit';

export default function CloseAuditCard({ review, competitionId, onChanged, isAdmin }) {
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const [notes, setNotes] = useState(review?.sign_off_notes || '');
  const [route, setRoute] = useState('head_judge');
  const [reason, setReason] = useState('');
  const cl = review?.checklist || {};

  const act = async (action, extra = {}) => {
    setBusy(action); setErr('');
    try { await auditAction(competitionId, action, extra); onChanged(); }
    catch (e) { setErr(e.message || 'Failed'); }
    finally { setBusy(''); }
  };

  const toggle = async (key, val) => act('set_check', { key, value: val });
  const openFindings = !!review; // findings shown by FindingsPanel regardless

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <FileSearch className="h-5 w-5 text-purple-400" />
          <h3 className="font-heading text-base font-bold">Close audit</h3>
        </div>
        <button onClick={() => act('close_audit')} disabled={!!busy} className="inline-flex items-center gap-1.5 rounded-xl grad-bg px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
          {busy === 'close_audit' ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSearch className="h-4 w-4" />} Recompute & run review
        </button>
      </div>

      {/* Recompute result */}
      {review?.recomputed?.recomputed_at && (
        <div className={`mt-4 rounded-xl border p-3 text-sm ${review.recomputed.matches_stored ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-300' : 'border-destructive/30 bg-destructive/5 text-destructive'}`}>
          {review.recomputed.matches_stored
            ? '✓ Recomputed combined scores match the stored CombinedResult records.'
            : '✗ Recomputed scores DO NOT match stored results — open a material finding before sign-off.'} ({review.recomputed.rows.length} entries recomputed)
        </div>
      )}
      {review?.vote_integrity?.scanned !== undefined && (
        <p className="mt-2 text-xs text-muted-foreground">Vote integrity: scanned {review.vote_integrity.scanned}, flagged {review.vote_integrity.flagged}, excluded {review.vote_integrity.excluded}.</p>
      )}

      {/* Checklist */}
      <ul className="mt-4 space-y-2">
        {CHECKLIST_ITEMS.map((it) => {
          const ok = !!cl[it.key];
          return (
            <li key={it.key}>
              <button
                onClick={() => toggle(it.key, !ok)}
                className="flex w-full items-start gap-2.5 rounded-lg border border-border bg-white/5 px-3 py-2.5 text-left text-sm transition hover:bg-muted"
              >
                {ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" /> : <Circle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />}
                <span className={ok ? 'text-foreground' : 'text-muted-foreground'}>{it.label}</span>
              </button>
            </li>
          );
        })}
      </ul>

      {/* Sign-off / route */}
      <div className="mt-5 flex flex-wrap gap-3">
        <button onClick={() => act('sign_off', { notes })} disabled={!!busy} className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500/15 px-4 py-2 text-sm font-bold text-emerald-400 hover:bg-emerald-500/25 disabled:opacity-50">
          {busy === 'sign_off' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />} Sign off & publish
        </button>
        <div className="flex flex-wrap items-center gap-2">
          <select value={route} onChange={(e) => setRoute(e.target.value)} className="rounded-lg border border-input bg-white/5 px-3 py-2 text-sm">
            <option value="head_judge">Head Judge</option>
            <option value="platform_admin">Platform Admin</option>
          </select>
          <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Routing reason…" className="w-48 rounded-lg border border-input bg-white/5 px-3 py-2 text-sm" />
          <button onClick={() => reason && act('route', { routed_to: route, reason })} disabled={!!busy || !reason} className="inline-flex items-center gap-1.5 rounded-xl bg-orange-500/15 px-4 py-2 text-sm font-bold text-orange-400 hover:bg-orange-500/25 disabled:opacity-50">
            <ArrowRight className="h-4 w-4" /> Route
          </button>
        </div>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Sign-off notes…" className="mt-2 w-full rounded-lg border border-input bg-white/5 px-3 py-2 text-sm" />
      </div>
      {review?.status === 'signed_off' && (
        <p className="mt-3 text-sm text-emerald-400">Independently audited by {review.sign_off_name} on {new Date(review.sign_off_at).toLocaleDateString()}.</p>
      )}
      {review?.status === 'routed' && (
        <p className="mt-3 text-sm text-orange-400">Routed to {review.routed_to} · re-audit #{review.re_audit_count}. Resolve findings then re-run close audit.</p>
      )}
      {err && <p className="mt-3 text-sm text-destructive">{err}</p>}
    </div>
  );
}
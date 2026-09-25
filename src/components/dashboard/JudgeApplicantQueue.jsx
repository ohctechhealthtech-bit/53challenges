import { useEffect, useState } from 'react';
import { Loader2, Check, X, CheckCircle2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { STATUS_LABELS, STATUS_STYLES } from '@/lib/judges';

export default function JudgeApplicantQueue({ onReload }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const list = await base44.entities.JudgeProfile.filter({ status: 'applicant' }, '-created_date', 200);
      setItems(list || []);
    } catch (e) {
      setError(e?.message || 'Failed to load applicants.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const decide = async (p, status) => {
    setBusy(p.id);
    setError('');
    try {
      const patch = { status };
      if (status === 'approved') patch.approved_categories = p.applied_categories || [];
      await base44.entities.JudgeProfile.update(p.id, patch);
      setItems((cur) => cur.filter((x) => x.id !== p.id));
      onReload?.();
    } catch (e) {
      setError(e?.message || 'Action failed.');
    } finally {
      setBusy('');
    }
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card/50 px-6 py-12 text-center">
        <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-400" />
        <p className="mt-3 text-sm text-muted-foreground">No pending judge applications.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error && <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive">{error}</p>}
      {items.map((p) => (
        <div key={p.id} className="rounded-2xl border border-border bg-card p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-bold">{p.name}</p>
              <p className="text-xs text-muted-foreground">{p.email} · {p.state}</p>
            </div>
            <span className={`rounded-lg border px-2.5 py-1 text-xs font-semibold ${STATUS_STYLES[p.status]}`}>{STATUS_LABELS[p.status]}</span>
          </div>
          <div className="mt-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Expertise</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {(p.applied_categories || []).map((c) => (
                <span key={c} className="rounded-lg border border-border bg-white/5 px-2.5 py-1 text-xs">{c}</span>
              ))}
            </div>
          </div>
          {p.experience && (
            <div className="mt-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Experience</p>
              <p className="mt-1 text-sm text-muted-foreground">{p.experience}</p>
            </div>
          )}
          {p.availability && (
            <div className="mt-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Availability</p>
              <p className="mt-1 text-sm text-muted-foreground">{p.availability}</p>
            </div>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <button disabled={busy === p.id} onClick={() => decide(p, 'approved')}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3.5 py-2 text-sm font-bold text-white hover:bg-emerald-600 disabled:opacity-50">
              <Check className="h-4 w-4" /> Approve
            </button>
            <button disabled={busy === p.id} onClick={() => decide(p, 'rejected')}
              className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/40 bg-destructive/10 px-3.5 py-2 text-sm font-bold text-destructive hover:bg-destructive/20 disabled:opacity-50">
              <X className="h-4 w-4" /> Reject
            </button>
            {busy === p.id && <Loader2 className="h-4 w-4 animate-spin" />}
          </div>
        </div>
      ))}
    </div>
  );
}
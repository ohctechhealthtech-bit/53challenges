import { useState } from 'react';
import { Plus, Check, Loader2, Megaphone } from 'lucide-react';
import { auditAction } from '@/lib/audit';

const SEV = [
  { v: 'info', c: 'text-blue-400 bg-blue-500/15' },
  { v: 'concern', c: 'text-amber-400 bg-amber-500/15' },
  { v: 'material', c: 'text-destructive bg-destructive/15' },
];
const CATS = ['terms', 'blind_judging', 'conflict', 'eligibility', 'evidence', 'vote_integrity', 'scoring', 'prize'];

export default function FindingsPanel({ review, competitionId, onChanged }) {
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ severity: 'concern', category: 'scoring', detail: '' });
  const findings = []; // provided by parent via prop? we set below
  const list = review?._findings || [];
  const [err, setErr] = useState('');

  const add = async () => {
    if (!form.detail.trim()) return;
    setBusy(true); setErr('');
    try { await auditAction(competitionId, 'add_finding', form); setForm({ ...form, detail: '' }); onChanged(); }
    catch (e) { setErr(e.message || 'Failed'); }
    finally { setBusy(false); }
  };
  const resolve = async (id, resolution) => {
    setBusy(true);
    try { await auditAction(competitionId, 'resolve_finding', { finding_id: id, resolution }); onChanged(); }
    catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center gap-2">
        <Megaphone className="h-5 w-5 text-amber-400" />
        <h3 className="font-heading text-base font-bold">Audit findings</h3>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <select value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value })} className="rounded-lg border border-input bg-white/5 px-3 py-2 text-sm">
          {SEV.map((s) => <option key={s.v} value={s.v}>{s.v}</option>)}
        </select>
        <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="rounded-lg border border-input bg-white/5 px-3 py-2 text-sm">
          {CATS.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <input value={form.detail} onChange={(e) => setForm({ ...form, detail: e.target.value })} placeholder="Finding detail…" className="flex-1 min-w-[200px] rounded-lg border border-input bg-white/5 px-3 py-2 text-sm" />
        <button onClick={add} disabled={busy} className="inline-flex items-center gap-1.5 rounded-xl grad-bg px-3 py-2 text-sm font-bold text-white disabled:opacity-50">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Add
        </button>
      </div>
      {err && <p className="mt-2 text-sm text-destructive">{err}</p>}
      <ul className="mt-4 space-y-2">
        {list.length === 0 && <li className="text-sm text-muted-foreground">No findings recorded.</li>}
        {list.map((f) => {
          const sev = SEV.find((s) => s.v === f.severity);
          return (
            <li key={f.id} className="rounded-xl border border-border bg-white/5 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${sev?.c}`}>{f.severity}</span>
                    <span className="text-[10px] font-semibold uppercase text-muted-foreground">{f.category}</span>
                    <span className={`text-[10px] font-bold ${f.status === 'open' ? 'text-amber-400' : f.status === 'routed' ? 'text-orange-400' : 'text-emerald-400'}`}>{f.status}</span>
                  </div>
                  <p className="mt-1 text-sm">{f.detail}</p>
                  {f.resolution && <p className="mt-1 text-xs text-muted-foreground">Resolved: {f.resolution}</p>}
                </div>
                {f.status === 'open' && (
                  <button onClick={() => resolve(f.id, 'Reviewed and resolved by auditor.')} className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/40 px-2.5 py-1.5 text-xs font-bold text-emerald-400 hover:bg-emerald-500/10">
                    <Check className="h-3.5 w-3.5" /> Resolve
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
import { useState } from 'react';
import { Wallet, Save, Plus, Trash2, Loader2, Ban, Coins } from 'lucide-react';
import { saveLedger, generatePayouts } from '@/lib/audit';

const EMPTY = { funding_source: 'platform', sponsor_name: '', sponsor_amount: 0, sponsor_received: false, total_pool: 0, currency: 'AUD', status: 'draft', placings: [] };

export default function PrizeLedgerCard({ ledger, competitionId, auditSignedOff, onChanged }) {
  const [f, setF] = useState(ledger ? normalize(ledger) : EMPTY);
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const isSponsor = f.funding_source === 'sponsor' || f.funding_source === 'mixed';
  const confirmed = ledger?.status === 'confirmed';

  const setPlacing = (i, patch) => {
    const arr = f.placings.map((p, idx) => idx === i ? { ...p, ...patch } : p);
    setF({ ...f, placings: arr });
  };
  const addPlace = () => setF({ ...f, placings: [...f.placings, { placing: f.placings.length + 1, label: '', amount: 0 }] });
  const delPlace = (i) => setF({ ...f, placings: f.placings.filter((_, idx) => idx !== i).map((p, idx) => ({ ...p, placing: idx + 1 })) });

  const save = async (confirm) => {
    setBusy('save'); setErr('');
    try {
      const sorted = f.placings.map((p, i) => ({ ...p, placing: p.placing || i + 1 })).sort((a, b) => a.placing - b.placing);
      await saveLedger(competitionId, { ...f, placings: sorted, status: confirm ? 'confirmed' : 'draft' }, ledger?.id);
      onChanged();
    } catch (e) { setErr(e.message || 'Failed'); }
    finally { setBusy(''); }
  };

  const genPayouts = async () => {
    setBusy('gen'); setErr('');
    try { await generatePayouts(competitionId); onChanged(); }
    catch (e) { setErr(e.message || 'Failed'); }
    finally { setBusy(''); }
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center gap-2">
        <Wallet className="h-5 w-5 text-amber-400" />
        <h3 className="font-heading text-base font-bold">Prize ledger</h3>
        {confirmed && <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-400">Confirmed</span>}
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <label className="text-sm"><span className="text-muted-foreground">Funding source</span>
          <select value={f.funding_source} onChange={(e) => setF({ ...f, funding_source: e.target.value })} className="mt-1 w-full rounded-lg border border-input bg-white/5 px-3 py-2 text-sm">
            <option value="entrant_fees">Entrant fees</option>
            <option value="sponsor">Sponsor</option>
            <option value="platform">Platform</option>
            <option value="mixed">Mixed</option>
          </select>
        </label>
        <label className="text-sm"><span className="text-muted-foreground">Total pool ({f.currency})</span>
          <input type="number" value={f.total_pool} onChange={(e) => setF({ ...f, total_pool: Number(e.target.value) })} className="mt-1 w-full rounded-lg border border-input bg-white/5 px-3 py-2 text-sm" />
        </label>
        <label className="text-sm"><span className="text-muted-foreground">Currency</span>
          <input value={f.currency} onChange={(e) => setF({ ...f, currency: e.target.value })} className="mt-1 w-full rounded-lg border border-input bg-white/5 px-3 py-2 text-sm" />
        </label>
      </div>
      {isSponsor && (
        <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={f.sponsor_received} onChange={(e) => setF({ ...f, sponsor_received: e.target.checked })} className="accent-amber-500" />
            <span className="font-semibold text-amber-300">Sponsored prize money received</span>
          </label>
          <input value={f.sponsor_name} onChange={(e) => setF({ ...f, sponsor_name: e.target.value })} placeholder="Sponsor name" className="flex-1 min-w-[160px] rounded-lg border border-input bg-white/5 px-3 py-2 text-sm" />
          <input type="number" value={f.sponsor_amount} onChange={(e) => setF({ ...f, sponsor_amount: Number(e.target.value) })} placeholder="Amount" className="w-28 rounded-lg border border-input bg-white/5 px-3 py-2 text-sm" />
        </div>
      )}
      <div className="mt-3 text-xs font-semibold uppercase text-muted-foreground">Placings & amounts</div>
      <div className="mt-2 space-y-2">
        {f.placings.map((p, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-white/5 p-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg grad-bg text-sm font-extrabold text-white">{p.placing}</span>
            <input value={p.label} onChange={(e) => setPlacing(i, { label: e.target.value })} placeholder="Label (e.g. 1st)" className="w-32 rounded-lg border border-input bg-background/60 px-2 py-1.5 text-sm" />
            <input type="number" value={p.amount} onChange={(e) => setPlacing(i, { amount: Number(e.target.value) })} placeholder="Amount" className="w-28 rounded-lg border border-input bg-background/60 px-2 py-1.5 text-sm" />
            {!confirmed && <button onClick={() => delPlace(i)} className="ml-auto rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-destructive"><Trash2 className="h-4 w-4" /></button>}
          </div>
        ))}
      </div>
      {!confirmed && (
        <button onClick={addPlace} className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-border bg-white/5 px-3 py-1.5 text-sm font-semibold hover:bg-muted"><Plus className="h-4 w-4" /> Add placing</button>
      )}
      <div className="mt-4 flex flex-wrap gap-3">
        {!confirmed && (
          <button onClick={() => save(false)} disabled={!!busy} className="inline-flex items-center gap-1.5 rounded-xl bg-white/5 px-4 py-2 text-sm font-bold text-foreground hover:bg-muted disabled:opacity-50">
            {busy === 'save' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save draft
          </button>
        )}
        {!confirmed && (
          <button onClick={() => save(true)} disabled={!!busy || isSponsor && !f.sponsor_received} className="inline-flex items-center gap-1.5 rounded-xl grad-bg px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
            <Coins className="h-4 w-4" /> Confirm ledger
          </button>
        )}
        <button onClick={genPayouts} disabled={!!busy || !auditSignedOff || !confirmed} className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500/15 px-4 py-2 text-sm font-bold text-emerald-400 hover:bg-emerald-500/25 disabled:opacity-50">
          {busy === 'gen' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />} Generate payouts
        </button>
        {!auditSignedOff && <span className="inline-flex items-center gap-1 text-xs text-amber-400"><Ban className="h-3.5 w-3.5" /> Winners verified via audit sign-off first</span>}
      </div>
      {err && <p className="mt-3 text-sm text-destructive">{err}</p>}
    </div>
  );
}

function normalize(l) {
  return {
    funding_source: l.funding_source || 'platform',
    sponsor_name: l.sponsor_name || '',
    sponsor_amount: l.sponsor_amount || 0,
    sponsor_received: !!l.sponsor_received,
    total_pool: l.total_pool || 0,
    currency: l.currency || 'AUD',
    status: l.status || 'draft',
    placings: (l.placings || []).map((p) => ({ ...p })),
  };
}
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Check, Plus, Trash2, ShieldCheck, ShieldAlert, Calculator, Save } from 'lucide-react';
import { corporateIntake } from '@/lib/corporateIntake';

const CURRENCY = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' });

export default function ServiceDeliveryPanel() {
  const [drafts, setDrafts] = useState([]);
  const [draftId, setDraftId] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [savingDeliverables, setSavingDeliverables] = useState(false);
  const [savingBand, setSavingBand] = useState(false);
  const [computing, setComputing] = useState(false);
  const [savingQuote, setSavingQuote] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [allocations, setAllocations] = useState([]);
  const [packagedFloor, setPackagedFloor] = useState(0);
  const [accountManager, setAccountManager] = useState('');
  const [computed, setComputed] = useState(null);

  useEffect(() => {
    (async () => {
      const res = await corporateIntake.listResponses({});
      setDrafts((res.responses || []).map((r) => r.draft).filter(Boolean));
    })();
  }, []);

  const load = async (id) => {
    setDraftId(id); setData(null); setComputed(null); setStatusMsg('');
    if (!id) return;
    setLoading(true);
    try {
      const d = await corporateIntake.getServiceDelivery(id);
      setData(d);
      setAllocations((d.allocations || []).map((a) => ({
        resource_type_id: a.resource_type_id,
        quantity: a.quantity,
        rate_override: a.rate_override,
        notes: a.notes,
      })));
      setPackagedFloor(d.quote?.packaged_floor || 0);
      setAccountManager(d.quote?.account_manager || '');
    } catch (e) {
      setStatusMsg(e.message || 'Failed to load');
    } finally { setLoading(false); }
  };

  const toggleDeliverable = async (delivId) => {
    const current = data.draft_deliverables || [];
    const next = current.includes(delivId) ? current.filter((x) => x !== delivId) : [...current, delivId];
    setData({ ...data, draft_deliverables: next });
    setSavingDeliverables(true);
    try {
      await corporateIntake.updateDraftDeliverables(draftId, next);
    } catch (e) { setStatusMsg(e.message); }
    finally { setSavingDeliverables(false); }
  };

  const changeBand = async (bandId) => {
    setData({ ...data, band: data.scale_bands.find((b) => b.id === bandId) || null, draft: { ...data.draft, scale_band: bandId } });
    setSavingBand(true);
    try { await corporateIntake.updateDraftScaleBand(draftId, bandId); }
    catch (e) { setStatusMsg(e.message); }
    finally { setSavingBand(false); }
  };

  const addAllocation = () => {
    const first = data.resource_types[0];
    setAllocations([...allocations, { resource_type_id: first?.id || '', quantity: 1, rate_override: 0, notes: '' }]);
  };
  const updateAlloc = (i, field, val) => {
    const next = [...allocations]; next[i] = { ...next[i], [field]: val }; setAllocations(next);
  };
  const removeAlloc = (i) => setAllocations(allocations.filter((_, idx) => idx !== i));

  const compute = async () => {
    setComputing(true); setStatusMsg('');
    try {
      const res = await corporateIntake.computeQuote(draftId, allocations, packagedFloor);
      setComputed(res);
    } catch (e) { setStatusMsg(e.message); }
    finally { setComputing(false); }
  };

  const saveQuote = async () => {
    setSavingQuote(true); setStatusMsg('');
    try {
      await corporateIntake.saveQuote({ draft_id: draftId, quote_id: data.quote?.id, allocations, packaged_floor: Number(packagedFloor), account_manager: accountManager });
      setStatusMsg('Quote saved.');
      await load(draftId);
    } catch (e) { setStatusMsg(e.message); }
    finally { setSavingQuote(false); }
  };

  const acceptQuote = async () => {
    if (!data.quote) return;
    try { await corporateIntake.acceptQuote(data.quote.id); setStatusMsg('Quote accepted.'); await load(draftId); }
    catch (e) { setStatusMsg(e.message); }
  };

  const approveDraft = async () => {
    setStatusMsg('');
    try { await corporateIntake.setDraftStatus(draftId, 'approved'); setStatusMsg('Draft approved.'); await load(draftId); }
    catch (e) { setStatusMsg(e.message || 'Blocked — by-proposal band requires an accepted quote.'); }
  };

  const bandByProposal = data?.band?.pricing_mode === 'by_proposal';
  const quoteAccepted = data?.quote?.status === 'accepted';

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-4">
        <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Select draft</label>
        <select className="c53-input mt-2" value={draftId} onChange={(e) => load(e.target.value)}>
          <option value="">— choose a draft —</option>
          {drafts.map((d) => (
            <option key={d.id} value={d.id}>{d.challenge_title || d.id} · {d.review_status}</option>
          ))}
        </select>
      </div>

      {statusMsg && <div className="rounded-lg bg-muted px-3 py-2 text-sm">{statusMsg}</div>}

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
      ) : data ? (
        <div className="space-y-4">
          {/* Scale band */}
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-sm font-semibold">Campaign scale band</p>
            <select className="c53-input mt-2" value={data.draft.scale_band || ''} onChange={(e) => changeBand(e.target.value)} disabled={savingBand}>
              <option value="">— none —</option>
              {data.scale_bands.map((b) => (
                <option key={b.id} value={b.id}>{b.name} · ×{b.service_fee_multiplier} · {b.pricing_mode}</option>
              ))}
            </select>
            {data.band && (
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                <span className="rounded-full bg-muted px-2 py-0.5">Multiplier ×{data.band.service_fee_multiplier}</span>
                <span className={`rounded-full px-2 py-0.5 ${data.band.pricing_mode === 'by_proposal' ? 'bg-amber-500/15 text-amber-400' : 'bg-emerald-500/15 text-emerald-400'}`}>{data.band.pricing_mode}</span>
                <span className="rounded-full bg-muted px-2 py-0.5">{data.band.routing}</span>
                {bandByProposal && !quoteAccepted && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-destructive/15 px-2 py-0.5 text-destructive"><ShieldAlert className="h-3 w-3" />Approval blocked — needs accepted quote</span>
                )}
                {bandByProposal && quoteAccepted && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-emerald-400"><ShieldCheck className="h-3 w-3" />Quote accepted — approval unlocked</span>
                )}
              </div>
            )}
          </div>

          {/* Deliverables checklist */}
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">Deliverables (producer checklist){savingDeliverables ? <Loader2 className="ml-2 inline h-3 w-3 animate-spin" /> : ''}</p>
              {data.tier && <span className="text-xs text-muted-foreground">Tier: {data.tier.name}</span>}
            </div>
            <ul className="mt-3 space-y-1.5">
              {data.deliverables.map((d) => {
                const checked = (data.draft_deliverables || []).includes(d.id);
                return (
                  <li key={d.id}>
                    <button onClick={() => toggleDeliverable(d.id)} className="flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-muted/40">
                      <span className={`mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded border ${checked ? 'border-primary bg-primary text-primary-foreground' : 'border-border'}`}>
                        {checked && <Check className="h-3 w-3" />}
                      </span>
                      <span>
                        <span className="text-sm font-medium">{d.name}</span>
                        {d.description && <span className="block text-xs text-muted-foreground">{d.description}</span>}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Enterprise quote */}
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">Enterprise quote</p>
              {data.quote && <span className={`rounded-full px-2 py-0.5 text-xs ${data.quote.status === 'accepted' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-muted text-muted-foreground'}`}>{data.quote.status}</span>}
            </div>

            <div className="mt-3 space-y-2">
              {allocations.map((a, i) => {
                const rt = data.resource_types.find((r) => r.id === a.resource_type_id);
                return (
                  <div key={i} className="flex flex-wrap items-center gap-2 rounded-lg bg-muted/30 p-2">
                    <select className="c53-input min-w-[160px] flex-1" value={a.resource_type_id} onChange={(e) => updateAlloc(i, 'resource_type_id', e.target.value)}>
                      {data.resource_types.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                    <input type="number" min="0" step="0.5" className="c53-input w-20" value={a.quantity} onChange={(e) => updateAlloc(i, 'quantity', Number(e.target.value))} />
                    <span className="text-xs text-muted-foreground">{rt?.unit || ''}</span>
                    <input type="number" min="0" step="50" className="c53-input w-24" placeholder="rate" value={a.rate_override} onChange={(e) => updateAlloc(i, 'rate_override', Number(e.target.value))} />
                    <button onClick={() => removeAlloc(i)} className="grid h-8 w-8 place-items-center rounded-lg text-destructive hover:bg-destructive/10"><Trash2 className="h-4 w-4" /></button>
                  </div>
                );
              })}
              <Button size="sm" variant="outline" onClick={addAllocation}><Plus className="mr-1 h-4 w-4" />Add line</Button>
            </div>

            <div className="mt-3 flex flex-wrap items-end gap-3">
              <label className="text-xs">
                <span className="mb-1 block font-semibold uppercase tracking-wide text-muted-foreground">Packaged floor ($)</span>
                <input type="number" min="0" step="100" className="c53-input w-32" value={packagedFloor} onChange={(e) => setPackagedFloor(Number(e.target.value))} />
              </label>
              <label className="text-xs">
                <span className="mb-1 block font-semibold uppercase tracking-wide text-muted-foreground">Account manager</span>
                <input className="c53-input w-40" value={accountManager} onChange={(e) => setAccountManager(e.target.value)} />
              </label>
              <Button size="sm" variant="outline" onClick={compute} disabled={computing}><Calculator className="mr-1 h-4 w-4" />{computing ? 'Computing…' : 'Compute'}</Button>
              <Button size="sm" onClick={saveQuote} disabled={savingQuote}><Save className="mr-1 h-4 w-4" />{savingQuote ? 'Saving…' : 'Save quote'}</Button>
              {data.quote && data.quote.status !== 'accepted' && <Button size="sm" variant="outline" onClick={acceptQuote}><ShieldCheck className="mr-1 h-4 w-4" />Accept</Button>}
            </div>

            {computed && (
              <div className="mt-4 rounded-lg border border-border bg-muted/20 p-3 text-sm">
                <table className="w-full">
                  <thead><tr className="text-xs uppercase text-muted-foreground"><th className="pb-1 text-left">Line</th><th className="pb-1 text-right">Qty</th><th className="pb-1 text-right">Rate</th><th className="pb-1 text-right">Total</th></tr></thead>
                  <tbody>
                    {computed.line_items.map((l, i) => (
                      <tr key={i} className="border-t border-border/50"><td className="py-1">{l.name}</td><td className="py-1 text-right">{l.quantity} {l.unit}</td><td className="py-1 text-right">{CURRENCY.format(l.rate)}</td><td className="py-1 text-right">{CURRENCY.format(l.line_total)}</td></tr>
                    ))}
                  </tbody>
                </table>
                <div className="mt-2 space-y-0.5 border-t border-border pt-2 text-xs">
                  <div className="flex justify-between"><span>Lines total</span><span>{CURRENCY.format(computed.lines_total)}</span></div>
                  <div className="flex justify-between"><span>Packaged floor</span><span>{CURRENCY.format(computed.packaged_floor)}</span></div>
                  <div className="flex justify-between font-bold text-foreground"><span>Quote total (max of floor / lines)</span><span>{CURRENCY.format(computed.total)}</span></div>
                </div>
              </div>
            )}
          </div>

          {/* Approve */}
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-sm font-semibold">Draft approval</p>
            <p className="mt-1 text-xs text-muted-foreground">Status: {data.draft.review_status}. {bandByProposal ? 'By-proposal band — approval requires an accepted quote.' : 'Standard band — no quote required.'}</p>
            <Button className="mt-3" size="sm" onClick={approveDraft} disabled={data.draft.review_status === 'approved'}>Approve draft</Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
import { useState } from 'react';
import { Button } from '@/components/ui/button';

// Sponsor cheques and donations coming in.
export default function ContributionForm({ season, readOnly, onSave }) {
  const [form, setForm] = useState({ source: 'sponsor_contribution', amount: '', allocation: 'split', note: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const set = (k, v) => { setForm((p) => ({ ...p, [k]: v })); setError(''); };

  const submit = async (e) => {
    e.preventDefault();
    const amount = Number(form.amount);
    if (!Number.isFinite(amount) || amount <= 0) { setError('Enter an amount above $0.'); return; }
    setSaving(true);
    setError('');
    try {
      await onSave({ season, source: form.source, amount, allocation: form.allocation, note: form.note.trim() });
      setForm({ source: 'sponsor_contribution', amount: '', allocation: 'split', note: '' });
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="rounded-2xl border border-border bg-card/60 p-5">
      <h3 className="font-heading text-base font-bold">Money coming in</h3>
      <p className="mt-1 text-sm text-muted-foreground">Record a sponsor payment or a donation.</p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="cont-source" className="mb-1.5 block text-sm font-semibold">Type</label>
          <select id="cont-source" className="c53-input" value={form.source} disabled={readOnly} onChange={(e) => set('source', e.target.value)}>
            <option value="sponsor_contribution">Sponsor contribution</option>
            <option value="donation">Donation</option>
          </select>
        </div>
        <div>
          <label htmlFor="cont-amount" className="mb-1.5 block text-sm font-semibold">Amount (AUD)</label>
          <input id="cont-amount" className="c53-input" inputMode="decimal" value={form.amount} disabled={readOnly} onChange={(e) => set('amount', e.target.value)} />
        </div>
        <div>
          <label htmlFor="cont-allocation" className="mb-1.5 block text-sm font-semibold">Goes to</label>
          <select id="cont-allocation" className="c53-input" value={form.allocation} disabled={readOnly} onChange={(e) => set('allocation', e.target.value)}>
            <option value="split">Split across both pools</option>
            <option value="sponsorship_pool">Sponsorship pool</option>
            <option value="competition_fund">Competition fund</option>
          </select>
        </div>
        <div>
          <label htmlFor="cont-note" className="mb-1.5 block text-sm font-semibold">Note</label>
          <input id="cont-note" className="c53-input" placeholder="Who it came from" value={form.note} disabled={readOnly} onChange={(e) => set('note', e.target.value)} />
        </div>
      </div>

      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
      <div className="mt-4">
        <Button type="submit" disabled={saving || readOnly}>{saving ? 'Recording…' : 'Record money in'}</Button>
      </div>
    </form>
  );
}
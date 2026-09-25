import { useState } from 'react';
import { Button } from '@/components/ui/button';

// Prizes, grants and running costs going out.
export default function DisbursementForm({ season, readOnly, onSave }) {
  const [form, setForm] = useState({ amount: '', pool: 'competition_fund', purpose: 'prize_paid', recipient: '', note: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const set = (k, v) => { setForm((p) => ({ ...p, [k]: v })); setError(''); };

  const submit = async (e) => {
    e.preventDefault();
    const amount = Number(form.amount);
    if (!Number.isFinite(amount) || amount <= 0) { setError('Enter an amount above $0.'); return; }
    if (!form.recipient.trim()) { setError('Say who is being paid.'); return; }
    setSaving(true);
    setError('');
    try {
      await onSave({ season, amount, pool: form.pool, purpose: form.purpose, recipient: form.recipient.trim(), note: form.note.trim() });
      setForm({ amount: '', pool: 'competition_fund', purpose: 'prize_paid', recipient: '', note: '' });
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="rounded-2xl border border-border bg-card/60 p-5">
      <h3 className="font-heading text-base font-bold">Money going out</h3>
      <p className="mt-1 text-sm text-muted-foreground">Record a prize payment, a grant or a running cost.</p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="dis-amount" className="mb-1.5 block text-sm font-semibold">Amount (AUD)</label>
          <input id="dis-amount" className="c53-input" inputMode="decimal" value={form.amount} disabled={readOnly} onChange={(e) => set('amount', e.target.value)} />
        </div>
        <div>
          <label htmlFor="dis-pool" className="mb-1.5 block text-sm font-semibold">Paid from</label>
          <select id="dis-pool" className="c53-input" value={form.pool} disabled={readOnly} onChange={(e) => set('pool', e.target.value)}>
            <option value="competition_fund">Competition fund</option>
            <option value="sponsorship_pool">Sponsorship pool</option>
          </select>
        </div>
        <div>
          <label htmlFor="dis-purpose" className="mb-1.5 block text-sm font-semibold">What for</label>
          <select id="dis-purpose" className="c53-input" value={form.purpose} disabled={readOnly} onChange={(e) => set('purpose', e.target.value)}>
            <option value="prize_paid">Prize payment</option>
            <option value="sponsorship_granted">Sponsorship grant</option>
            <option value="cost">Running cost</option>
          </select>
        </div>
        <div>
          <label htmlFor="dis-recipient" className="mb-1.5 block text-sm font-semibold">Paid to</label>
          <input id="dis-recipient" className="c53-input" value={form.recipient} disabled={readOnly} onChange={(e) => set('recipient', e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="dis-note" className="mb-1.5 block text-sm font-semibold">Note</label>
          <input id="dis-note" className="c53-input" placeholder="e.g. Adults division winner" value={form.note} disabled={readOnly} onChange={(e) => set('note', e.target.value)} />
        </div>
      </div>

      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
      <div className="mt-4">
        <Button type="submit" disabled={saving || readOnly}>{saving ? 'Recording…' : 'Record money out'}</Button>
      </div>
    </form>
  );
}
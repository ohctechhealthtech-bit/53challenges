import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { money } from './fundsMeta';

// Base fee plus optional per-division rates. Leaving a division blank keeps it
// on the base fee.
export default function EntryFeePanel({ entryFee, challengeId, readOnly, onSave }) {
  const [base, setBase] = useState('');
  const [overrides, setOverrides] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setBase(String(entryFee?.base_fee ?? ''));
    const next = {};
    (entryFee?.divisions || []).forEach((d) => { if (d.is_override) next[d.id] = String(d.fee ?? ''); });
    setOverrides(next);
  }, [entryFee]);

  const submit = async (e) => {
    e.preventDefault();
    const fee = Number(base);
    if (!Number.isFinite(fee) || fee < 0) { setError('Enter a base fee of $0 or more.'); return; }
    const divisionOverrides = Object.entries(overrides)
      .filter(([, v]) => String(v).trim() !== '')
      .map(([division_id, v]) => ({ division_id, amount: Number(v) }));
    if (divisionOverrides.some((o) => !Number.isFinite(o.amount) || o.amount < 0)) {
      setError('Division rates must be $0 or more.'); return;
    }
    setSaving(true);
    setError('');
    try {
      await onSave({ challengeId, entryFee: fee, divisionOverrides });
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="rounded-2xl border border-border bg-card/60 p-5">
      <h3 className="font-heading text-base font-bold">Entry fee</h3>
      <p className="mt-1 text-sm text-muted-foreground">What it costs to enter this challenge.</p>

      <div className="mt-4 max-w-[220px]">
        <label htmlFor="funds-base-fee" className="mb-1.5 block text-sm font-semibold">Base fee (AUD)</label>
        <input
          id="funds-base-fee"
          className="c53-input"
          inputMode="decimal"
          value={base}
          disabled={readOnly}
          onChange={(e) => { setBase(e.target.value); setError(''); }}
        />
      </div>

      {(entryFee?.divisions || []).length > 0 && (
        <div className="mt-5">
          <p className="text-sm font-semibold">Different rate by division <span className="font-normal text-muted-foreground">(optional)</span></p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {entryFee.divisions.map((d) => (
              <div key={d.id}>
                <label htmlFor={`fee-${d.id}`} className="mb-1.5 block text-sm">{d.name}</label>
                <input
                  id={`fee-${d.id}`}
                  className="c53-input"
                  inputMode="decimal"
                  placeholder={`Base ${money(entryFee.base_fee)}`}
                  value={overrides[d.id] ?? ''}
                  disabled={readOnly}
                  onChange={(e) => { setOverrides((p) => ({ ...p, [d.id]: e.target.value })); setError(''); }}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
      <div className="mt-4">
        <Button type="submit" disabled={saving || readOnly}>{saving ? 'Saving…' : 'Save entry fee'}</Button>
      </div>
    </form>
  );
}
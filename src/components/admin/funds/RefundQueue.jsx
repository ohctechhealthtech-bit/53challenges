import { useState } from 'react';
import { money } from './fundsMeta';

// Rejected entries whose fee is waiting to be refunded.
export default function RefundQueue({ items = [], count = 0, readOnly, onRefund }) {
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  const refund = async (item) => {
    setBusy(item.entry_id);
    setError('');
    try {
      await onRefund({ entryId: item.entry_id });
    } catch (e) {
      setError(`${item.title}: ${e.message}`);
    } finally {
      setBusy('');
    }
  };

  return (
    <section className="mt-8">
      <h3 className="font-heading text-base font-bold">
        Refunds waiting
        <span className="ml-2 text-sm font-normal text-muted-foreground">{count}</span>
      </h3>
      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
      <div className="mt-4 overflow-x-auto rounded-2xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Entry</th>
              <th className="px-4 py-3">Entrant</th>
              <th className="px-4 py-3">Why rejected</th>
              <th className="px-4 py-3 text-right">Fee paid</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.entry_id} className="border-t border-border align-top">
                <td className="px-4 py-3">
                  <span className="block font-semibold">{item.title}</span>
                  <span className="text-xs text-muted-foreground">{item.challenge_title}</span>
                </td>
                <td className="px-4 py-3">
                  <span className="block">{item.entrant_name}</span>
                  <span className="text-xs text-muted-foreground">{item.entrant_email}</span>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{item.rejection_reason || '—'}</td>
                <td className="px-4 py-3 text-right font-semibold">{money(item.entry_fee_paid)}</td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => refund(item)}
                    disabled={readOnly || busy === item.entry_id || item.refund_status !== 'pending_review'}
                    className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted disabled:opacity-50"
                  >
                    {busy === item.entry_id ? 'Refunding…' : 'Refund fee'}
                  </button>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">No refunds are waiting.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
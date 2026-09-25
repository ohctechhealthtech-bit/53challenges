/**
 * The host's invoices and their payment status.
 */
import { Receipt } from 'lucide-react';
import { formatAud } from '@/lib/hostDeposit';

export function InvoiceStatusBadge({ status }) {
  const styles = {
    paid: 'bg-emerald-500/15 text-emerald-300',
    pending: 'bg-amber-500/15 text-amber-300',
    void: 'bg-muted text-muted-foreground',
  };
  const labels = { paid: 'Paid', pending: 'Awaiting payment', void: 'Cancelled' };
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${styles[status] || styles.pending}`}>
      {labels[status] || status}
    </span>
  );
}

export default function InvoicesPanel({ invoices }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <Receipt className="h-3.5 w-3.5" /> Invoices
      </p>
      {invoices.length === 0 ? (
        <p className="py-2 text-sm text-muted-foreground">No invoices yet.</p>
      ) : (
        <ul className="divide-y divide-border">
          {invoices.map((inv) => (
            <li key={inv.id} className="flex items-center justify-between gap-3 py-2.5">
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">{inv.label || 'Invoice'}</span>
                <span className="text-xs text-muted-foreground">
                  {new Date(inv.created_date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <span className="text-sm font-bold">{formatAud((inv.amount || 0) / 100)}</span>
                <InvoiceStatusBadge status={inv.status} />
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
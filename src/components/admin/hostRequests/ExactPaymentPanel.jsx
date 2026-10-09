import { useEffect, useState } from 'react';
import { BadgeCheck } from 'lucide-react';
import { hostPortal } from '@/lib/hostPortalClient';

const aud = (cents) =>
  'A$' + (Number(cents || 0) / 100).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * What the host actually paid, as Stripe confirmed it — shown beside the
 * request's own figures, which come from the parent app and have disagreed
 * with the real charge. Renders nothing when this host has no payment with us.
 */
export default function ExactPaymentPanel({ email, requestId }) {
  const [payments, setPayments] = useState(null);

  useEffect(() => {
    if (!email) { setPayments([]); return undefined; }
    let live = true;
    hostPortal('admin_payments', { email, request_id: requestId })
      .then((d) => { if (live) setPayments(d?.payments || []); })
      .catch(() => { if (live) setPayments([]); });
    return () => { live = false; };
  }, [email, requestId]);

  if (!payments || payments.length === 0) return null;
  const matched = payments.filter((p) => p.matches_request);
  const shown = matched.length ? matched : payments;

  return (
    <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-4">
      <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-emerald-300">
        <BadgeCheck className="h-4 w-4" /> Paid by card (Stripe-verified)
      </p>
      <ul className="space-y-2">
        {shown.map((p) => (
          <li key={p.invoice_number} className="text-sm">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="font-heading text-lg font-extrabold">{aud(p.amount_cents)}</span>
              <span className="text-xs text-muted-foreground">
                incl. GST {aud(p.gst_cents)} · {p.invoice_number}
                {p.paid_at ? ' · ' + new Date(p.paid_at).toLocaleString('en-AU') : ''}
              </span>
            </div>
            {Array.isArray(p.lines) && p.lines.length > 0 && (
              <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                {p.lines.map((l, i) => (
                  <li key={i} className="flex justify-between gap-2"><span>{l.name}</span><span>{aud(l.amount_cents)}</span></li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
      {!matched.length && payments.length > 0 && (
        <p className="mt-2 text-xs text-muted-foreground">Shown for this host&apos;s email; not linked to this request id.</p>
      )}
    </div>
  );
}

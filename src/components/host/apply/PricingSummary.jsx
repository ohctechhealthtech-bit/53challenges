/**
 * Live price breakdown for the application — fetched from the server so the
 * amount shown always matches what will be charged.  Every line item AND the
 * total come from the main app's guest_apply quote (the single source of
 * truth).  No child-only lines are added.
 */
import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { hostPortal } from '@/lib/hostPortalClient';
import { formatAud } from '@/lib/hostDeposit';

export default function PricingSummary({ answers, onPricing, draftId }) {
  const [pricing, setPricing] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    hostPortal('price_application', { answers, draft_id: draftId })
      .then((data) => {
        if (!active) return;
        setPricing(data.pricing);
        onPricing?.(data.pricing);
      })
      .catch((e) => { if (active) setError(e?.message || 'Could not price your application'); });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (!pricing) {
    return (
      <div className="flex items-center justify-center rounded-2xl border border-border bg-card py-8">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }

  const lines = (pricing.line_items || []).filter((l) => l.amount > 0);

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Your application</p>
      {lines.length === 0 && (
        <p className="text-sm text-muted-foreground">Nothing to pay now — the self-service package is free to apply.</p>
      )}
      <ul className="space-y-2">
        {lines.map((l) => (
          <li key={l.name} className="flex items-center justify-between text-sm">
            <span>{l.name}</span>
            <span className="font-semibold">{formatAud(l.amount / 100)}</span>
          </li>
        ))}
      </ul>
      {lines.length > 0 && (
        <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
          <span className="text-sm font-semibold">Total due now</span>
          <span className="font-heading text-lg font-extrabold">{formatAud(pricing.total_amount / 100)}</span>
        </div>
      )}
    </div>
  );
}
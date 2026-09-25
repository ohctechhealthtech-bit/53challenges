import React from 'react';

// Per-tier scope panel — shows the deliverables mapped to the selected
// ServiceTier (from Deliverable reference data), for context only.
export default function TierScopePanel({ tier, deliverables }) {
  if (!tier) return null;
  const names = tier.deliverables || [];
  const matched = names
    .map((name) => deliverables.find((d) => d.name === name))
    .filter(Boolean);

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h3 className="font-heading text-sm font-semibold">{tier.name} — what's included</h3>
      {tier.description && <p className="mt-1 text-xs text-muted-foreground">{tier.description}</p>}
      <ul className="mt-3 space-y-2">
        {matched.map((d) => (
          <li key={d.id} className="text-sm">
            <span className="font-medium">{d.name}</span>
            {d.description && <span className="text-muted-foreground"> — {d.description}</span>}
          </li>
        ))}
        {matched.length === 0 && (
          <li className="text-sm text-muted-foreground">No deliverables mapped to this tier.</li>
        )}
      </ul>
    </div>
  );
}